#!/usr/bin/env node
/**
 * Database robustness check — drives N complete participant sessions through the
 * real API handlers, then verifies every retrieval path.
 *
 *   MONGODB_URI="mongodb+srv://…/decision_study_loadtest" \
 *   ADMIN_SECRET="…" \
 *   node scripts/loadtest.js --participants 500 --confirm
 *
 * SAFETY. This writes hundreds of synthetic participants. It refuses to run
 * unless BOTH are true:
 *   1. --confirm is passed, and
 *   2. the database name contains "test", "loadtest", "staging" or "scratch".
 *
 * Point it at a scratch database on the SAME cluster as production. That
 * exercises the real tier, network and storage engine, while keeping synthetic
 * participants out of the dataset you will actually analyse — dropping a
 * database is one command; unpicking 500 fake participants from real ones after
 * recruitment has started is not.
 *
 * Pass --keep to leave the data in place for inspection; the default drops it.
 */
import mongoose from 'mongoose'

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : (args[i + 1]?.startsWith('--') ? true : args[i + 1] ?? true)
}
const N = Number(flag('participants', 500))
const CONFIRMED = args.includes('--confirm')
const KEEP = args.includes('--keep')

const uri = process.env.MONGODB_URI
if (!uri) { console.error('MONGODB_URI is not set.'); process.exit(1) }

const dbName = (uri.split('/').pop() || '').split('?')[0]
const looksLikeScratch = /test|loadtest|staging|scratch/i.test(dbName)

console.log(`\ntarget database : ${dbName}`)
console.log(`participants    : ${N}`)

if (!looksLikeScratch) {
  console.error(`\nREFUSING TO RUN.\n`)
  console.error(`  "${dbName}" does not look like a scratch database.`)
  console.error(`  This writes ${N} synthetic participants. Run it against a database`)
  console.error(`  named e.g. decision_study_loadtest on the same cluster, then drop it.\n`)
  process.exit(1)
}
if (!CONFIRMED) {
  console.error('\nRefusing to run without --confirm.\n')
  process.exit(1)
}

const assignMode = (await import('../api/assign-mode.js')).default
const telemetry  = (await import('../api/telemetry/index.js')).default
const participantsApi = (await import('../api/admin/participants.js')).default
const exportApi  = (await import('../api/admin/export.js')).default

function call(handler, opts) {
  return new Promise((resolve) => {
    let statusCode = 200, data = null
    const res = {
      setHeader() { return this }, status(c) { statusCode = c; return this },
      json(d) { data = d; resolve({ statusCode, data }); return this },
      send(d) { data = d; resolve({ statusCode, data }); return this },
      end() { resolve({ statusCode, data }); return this },
    }
    Promise.resolve(handler({ method: 'GET', query: {}, body: {}, headers: {}, ...opts }, res))
      .catch((e) => resolve({ statusCode: 500, data: { error: e.message } }))
  })
}

const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length * p)] ?? 0
const rnd = (a, b) => a + Math.random() * (b - a)
const secret = process.env.ADMIN_SECRET || ''

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
const admin = mongoose.connection.db.admin()
try {
  const info = await admin.serverStatus()
  console.log(`server          : MongoDB ${info.version} (${info.storageEngine?.name ?? 'unknown engine'})`)
} catch { console.log('server          : (serverStatus not permitted — shared tier)') }

const Models = {}
for (const n of ['ModeCounter','ParticipantMode','ParticipantTrialPlan','TelemetryEvent','TrialResult','PostTaskResponse']) {
  Models[n] = (await import(`../lib/models/${n}.js`)).default
}

console.log('\nclearing scratch database and syncing indexes…')
await mongoose.connection.dropDatabase()
for (const m of Object.values(Models)) await m.syncIndexes()

// ── 1. Assignment ───────────────────────────────────────────────────────────
console.log(`\n1. ASSIGNMENT — ${N} participants`)
const assignMs = []
const assigned = []
const t0 = Date.now()
for (let i = 0; i < N; i++) {
  const type = i % 5 === 0 ? 'expert' : 'novice'
  const t = Date.now()
  const r = await call(assignMode, { method: 'POST', body: { participantType: type, priorParticipantId: `P-PROV-${i}` } })
  assignMs.push(Date.now() - t)
  if (r.statusCode !== 200) { console.error('  assignment failed:', r.data); process.exit(1) }
  assigned.push({ ...r.data, type })
  if ((i + 1) % 100 === 0) process.stdout.write(`   ${i + 1}/${N}\r`)
}
console.log(`   ${N}/${N} in ${((Date.now() - t0) / 1000).toFixed(1)}s` +
  `   median ${pct(assignMs, .5)}ms  p95 ${pct(assignMs, .95)}ms  max ${Math.max(...assignMs)}ms`)

// ── 2. Sessions ─────────────────────────────────────────────────────────────
console.log(`\n2. SESSIONS — consent, 12 trials and the closing battery each`)
const ingestMs = []
let evId = 0, completed = 0, abandoned = 0
const t1 = Date.now()
for (const [i, a] of assigned.entries()) {
  const P = a.participantId
  const ev = (type, payload, trialId = null) => ({
    eventId: `EV-${P}-${++evId}`, eventType: type, timestamp: new Date().toISOString(),
    sessionId: `S-${P}`, participantId: P, condition: a.condition,
    participantType: a.type, trialId, screen: 'scored',
    applicationVersion: '0.2.0', studyVersion: '4.1.0', payload,
  })

  // ~8% abandon partway, as a real cohort does
  const abandons = Math.random() < 0.08
  const nTrials = abandons ? Math.floor(rnd(1, 11)) : 12
  if (abandons) abandoned++; else completed++

  const batch = [ev('CONSENT_COMPLETED', {
    programme: ['Business / management','Engineering / operations','Data / computer science'][i % 3],
    studyYear: ['First year','Second year','Postgraduate'][i % 3],
    supplyChainExperience: a.type === 'expert' ? 'Professional experience' : 'None',
    aiUse: ['Never','Monthly','Weekly','Daily or almost daily'][i % 4],
    gender: ['Woman','Man','Prefer not to say'][i % 3], age: 19 + (i % 35),
  })]

  for (let k = 0; k < nTrials; k++) {
    const it = a.trialPlan[k]
    const truth = it.recommendation
    const initial = Math.round(truth * rnd(0.75, 1.25))
    const final = Math.round(initial + (truth - initial) * rnd(0, 0.9))
    const dwell = Math.round(rnd(9000, 70000))
    const away = Math.random() < 0.15 ? Math.round(rnd(2000, 30000)) : 0
    batch.push(ev('FINAL_ESTIMATE_SUBMITTED', {
      trialId: it.trialId, isPractice: false,
      initialEstimate: initial, aiRecommendation: truth, finalEstimate: final,
      finalConfidence: 1 + Math.floor(Math.random() * 7),
      cognitiveLoad: 1 + Math.floor(Math.random() * 7),
      verificationResponse: ['too_high','about_right','too_low'][Math.floor(Math.random() * 3)],
      step1DwellMs: Math.round(dwell * .4), step2DwellMs: Math.round(dwell * .2),
      step3DwellMs: Math.round(dwell * .15), step4DwellMs: Math.round(dwell * .25),
      totalTrialDwellMs: dwell, totalActiveDwellMs: dwell - away, totalAwayMs: away,
      step1ActiveDwellMs: Math.round((dwell * .4) - away), step2ActiveDwellMs: Math.round(dwell * .2),
      step3ActiveDwellMs: Math.round(dwell * .15), step4ActiveDwellMs: Math.round(dwell * .25),
      scrollDepthPct: Math.round(rnd(20, 100)), chartRevisitCount: Math.floor(rnd(0, 6)),
      interactionCount: Math.floor(rnd(5, 30)), orderIndex: it.orderIndex,
    }, it.trialId))
  }

  if (!abandons) {
    batch.push(ev('QUESTIONNAIRE_COMPLETED', { instrumentId: 'POST_TASK', responses: {
      nasaTlx: { dimensions: {
        mentalDemand: Math.round(rnd(10,100)), physicalDemand: Math.round(rnd(0,40)),
        temporalDemand: Math.round(rnd(10,90)), performance: Math.round(rnd(20,95)),
        effort: Math.round(rnd(15,95)), frustration: Math.round(rnd(0,80)) },
        rawTlxAverage: Math.round(rnd(20,80)) },
      numeracy: { rawResponses: {}, scored: { objectiveScore: Math.floor(rnd(0,4)), totalObjective: 3, subjectiveScore: Math.ceil(rnd(1,7)) } },
      domainExperience: {
        yearsExperience: a.type === 'expert' ? ['3-5','6-10','>10'][i % 3] : '0',
        primaryRole: a.type === 'expert' ? 'analyst_planner' : 'student_undergrad',
        decisionFrequency: a.type === 'expert' ? 'daily' : 'never',
        certifications: 'none', feedback: '' },
      expertReliance: a.type === 'expert'
        ? { relianceOnOwnHeuristics: Math.ceil(rnd(1,7)), taskRealism: Math.ceil(rnd(1,5)), heuristicDescription: '' }
        : null,
      participantType: a.type, submittedAt: new Date().toISOString(),
    }}))
    batch.push(ev('SESSION_COMPLETED', { totalDurationMs: Math.round(rnd(1.2e6, 3.2e6)) }))
  }

  // Sent the way the client sends: batches of at most 40.
  for (let k = 0; k < batch.length; k += 40) {
    const t = Date.now()
    const r = await call(telemetry, { method: 'POST', body: batch.slice(k, k + 40) })
    ingestMs.push(Date.now() - t)
    if (r.statusCode !== 200) { console.error('  ingest failed:', r.data); process.exit(1) }
  }
  if ((assigned.indexOf(a) + 1) % 100 === 0) process.stdout.write(`   ${assigned.indexOf(a) + 1}/${N}\r`)
}
console.log(`   ${N}/${N} in ${((Date.now() - t1) / 1000).toFixed(1)}s` +
  `   ingest median ${pct(ingestMs, .5)}ms  p95 ${pct(ingestMs, .95)}ms  max ${Math.max(...ingestMs)}ms`)
console.log(`   ${completed} completed · ${abandoned} abandoned partway`)

// ── 3. Stored ───────────────────────────────────────────────────────────────
console.log('\n3. STORED')
const counts = {}
for (const [n, m] of Object.entries(Models)) counts[n] = await m.countDocuments()
for (const [n, c] of Object.entries(counts)) console.log(`   ${n.padEnd(22)} ${c.toLocaleString()}`)
try {
  const st = await mongoose.connection.db.stats()
  console.log(`   ${'data size'.padEnd(22)} ${(st.dataSize/1024/1024).toFixed(1)} MB` +
              `   storage ${(st.storageSize/1024/1024).toFixed(1)} MB   indexes ${(st.indexSize/1024/1024).toFixed(1)} MB`)
} catch { console.log('   (dbStats not permitted)') }

// ── 4. Retrieval ────────────────────────────────────────────────────────────
console.log('\n4. RETRIEVAL')
let t = Date.now()
const dash = await call(participantsApi, { method: 'GET', headers: { 'x-admin-secret': secret } })
const dashMs = Date.now() - t
if (dash.statusCode !== 200) console.log('   ✗ dashboard:', dash.data)
else {
  const s = dash.data.stats
  console.log(`   ✓ dashboard        ${dashMs}ms   ${s.total} participants` +
    `   novice ${JSON.stringify(s.matrix.novice)}   expert ${JSON.stringify(s.matrix.expert)}`)
  console.log(`     completed ${s.completed} · in progress ${s.inProgress} · unassigned ${s.conditions.unassigned}` +
    `   orders in use ${Object.keys(s.orders).length}/12   flagged ${s.flaggedParticipants}`)
}
t = Date.now()
const ex = await call(exportApi, { method: 'GET', query: { format: 'json' }, headers: { 'x-admin-secret': secret } })
const exMs = Date.now() - t
if (ex.statusCode !== 200) console.log('   ✗ export:', ex.data)
else {
  const rows = ex.data.data
  const cols = Object.keys(rows[0] || {}).length
  const withDemo = rows.filter((r) => r.demoAge != null).length
  console.log(`   ✓ export           ${exMs}ms   ${rows.length.toLocaleString()} rows × ${cols} columns` +
    `   demographics on ${(withDemo / rows.length * 100).toFixed(0)}% of rows`)
  console.log(`     manifest: flagged ${ex.data.manifest.flaggedRows} · below floor ${ex.data.manifest.belowTimeFloorRows}` +
    ` · missing demographics ${ex.data.manifest.rowsMissingDemographics}`)
}
t = Date.now()
const csv = await call(exportApi, { method: 'GET', query: { format: 'csv' }, headers: { 'x-admin-secret': secret } })
console.log(`   ✓ csv export       ${Date.now() - t}ms   ${(Buffer.byteLength(String(csv.data))/1024/1024).toFixed(1)} MB`)

// ── 5. Integrity ────────────────────────────────────────────────────────────
console.log('\n5. INTEGRITY')
const TR = Models.TrialResult, PM = Models.ParticipantMode
const byCond = await TR.aggregate([{ $match: { isPractice: false } },
  { $group: { _id: { c: '$condition', t: '$participantType' }, n: { $sum: 1 },
              regret: { $avg: '$directionalCostRegret' }, woa: { $avg: '$weightOfAdvice' } } },
  { $sort: { '_id.t': 1, '_id.c': 1 } }])
console.log('   cell            n rows   mean directional regret   mean WoA')
for (const r of byCond) {
  console.log(`   ${(r._id.t + ' ' + r._id.c).padEnd(14)} ${String(r.n).padStart(6)}` +
    `   ${Math.round(r.regret).toLocaleString().padStart(20)}   ${r.woa == null ? 'n/a' : r.woa.toFixed(3).padStart(8)}`)
}
const nulls = await TR.countDocuments({ $or: [{ condition: null }, { isCorrect: null }, { groundTruthOptimal: null }] })
const flagged = await TR.countDocuments({ 'integrityFlags.0': { $exists: true } })
const dupIds = await Models.TelemetryEvent.aggregate([{ $group: { _id: '$eventId', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: 'n' }])
console.log(`   rows with null condition/correctness/truth : ${nulls}`)
console.log(`   rows carrying integrity flags             : ${flagged}`)
console.log(`   duplicate eventIds                        : ${dupIds[0]?.n ?? 0}`)

// assignmentSeq is per expertise group, so each group must run 1..n with no
// gaps and no repeats. A repeat would mean two participants took the same slot.
for (const group of ['novice', 'expert']) {
  const rows = await PM.find({ participantType: group }, 'assignmentSeq').lean()
  const seqs = rows.map((r) => r.assignmentSeq).sort((a, b) => a - b)
  const unique = new Set(seqs).size
  const contiguous = seqs.every((v, i) => v === i + 1)
  const ok = unique === seqs.length && contiguous
  console.log(`   ${group} assignment sequence`.padEnd(45) +
    `: ${seqs.length} rows, 1..${seqs[seqs.length - 1]}, ` +
    `${unique === seqs.length ? 'no collisions' : 'COLLISIONS'}${contiguous ? ', no gaps' : ', GAPS'} ${ok ? '✓' : '✗'}`)
}

if (!KEEP) {
  await mongoose.connection.dropDatabase()
  console.log('\nscratch database dropped (pass --keep to retain it)')
}
await mongoose.disconnect()
console.log('\nload test complete.\n')
