#!/usr/bin/env node
/**
 * Deployment preflight (§5.1 of PROTOCOL_GAPS_REMAINING.md).
 *
 * Checks everything that can be checked without a participant: environment
 * configuration, counterbalancing constraints, stimulus integrity, and — when
 * MONGODB_URI is reachable — database indexes and collection state.
 *
 *   node scripts/preflight.js
 *
 * Exits non-zero if anything would compromise a live run.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
let warnings = 0
const fail = (m) => { console.log(`  ✗ ${m}`); failures++ }
const warn = (m) => { console.log(`  ! ${m}`); warnings++ }
const pass = (m) => console.log(`  ✓ ${m}`)

// ── 1. Environment ──────────────────────────────────────────────────────────
console.log('\n1. ENVIRONMENT')
if (!process.env.MONGODB_URI) fail('MONGODB_URI is not set')
else pass('MONGODB_URI set')

const secret = process.env.ADMIN_SECRET
if (!secret) fail('ADMIN_SECRET is not set — admin API will refuse all access (503)')
else if (secret.length < 16) fail(`ADMIN_SECRET is ${secret.length} chars; minimum is 16`)
else if (secret === 'study-admin') fail('ADMIN_SECRET is the old default value')
else pass('ADMIN_SECRET set and of adequate length')

if (process.env.STUDY_ALLOWED_ORIGINS) pass(`CORS allow-list: ${process.env.STUDY_ALLOWED_ORIGINS}`)
else warn('STUDY_ALLOWED_ORIGINS unset — same-origin only (correct for a single-domain deployment)')

const sw = Number(process.env.STOCKOUT_PENALTY_WEIGHT ?? 1.85)
const hw = Number(process.env.HOLDING_PENALTY_WEIGHT ?? 1.0)
if (!Number.isFinite(sw) || !Number.isFinite(hw)) fail('penalty weights are not numeric')
else pass(`regret weights: stockout ${sw}x / holding ${hw}x`)

// ── 2. Client build flags ───────────────────────────────────────────────────
console.log('\n2. CLIENT BUILD')
let bundleChecked = false
try {
  const { readdirSync } = await import('node:fs')
  const assets = readdirSync(join(ROOT, 'dist', 'assets'))
  const js = assets.filter((f) => f.endsWith('.js'))
  if (js.length) {
    const bundle = readFileSync(join(ROOT, 'dist', 'assets', js[0]), 'utf8')
    bundleChecked = true
    if (/VITE_ALLOW_URL_OVERRIDES|allowUrlOverrides/.test(bundle) && /"true"===/.test(bundle) === false) {
      pass('built bundle present')
    }
    if (bundle.includes('TODO_DEBRIEF_TEXT')) fail('built bundle still contains TODO_DEBRIEF_TEXT — debrief copy is a placeholder (E-1)')
    else pass('no TODO_DEBRIEF_TEXT in bundle')
    if (bundle.includes('TODO_INCENTIVE_COPY') || bundle.includes('TODO_ETHICS_COPY')) {
      fail('built bundle still contains consent TODO copy (E-2)')
    } else pass('no consent TODO copy in bundle')
    if (/TODO_(C1_EXPLANATION|CHART_DATA|METADATA|DATASET)/.test(bundle)) {
      fail('built bundle contains stimulus TODO placeholders')
    } else pass('no stimulus TODO placeholders in bundle')
  }
} catch {
  warn('dist/ not built — run `npm run build` before deploying, then re-run preflight')
}
if (process.env.VITE_ALLOW_URL_OVERRIDES === 'true') {
  fail('VITE_ALLOW_URL_OVERRIDES=true — participants could override condition and trial from the URL')
} else pass('URL overrides disabled for the participant build')

// ── 3. Counterbalancing (§5.6, §5.11) ───────────────────────────────────────
console.log('\n3. COUNTERBALANCING')
const {
  VALID_PLAN_PAIRS, generateParticipantTrialPlan, validateTrialPlan, SCORED_TRIAL_IDS,
} = await import(join(ROOT, 'src/utils/counterbalance.js'))
const { getScenarioById } = await import(join(ROOT, 'src/scenarios/index.js'))
const { assignmentForSequence } = await import(join(ROOT, 'lib/assignment.js'))

pass(`${VALID_PLAN_PAIRS.length} valid (order, schedule) pairs`)

let planProblems = 0
const incorrectCount = {}
const positionOfInstance = {}
for (let i = 0; i < VALID_PLAN_PAIRS.length; i++) {
  const plan = generateParticipantTrialPlan(i, getScenarioById, 'c2')
  const check = validateTrialPlan(plan)
  if (!check.valid) { planProblems++; fail(`plan ${i}: ${check.problems.join('; ')}`) }
  plan.forEach((t, pos) => {
    if (!t.isCorrect) incorrectCount[t.trialId] = (incorrectCount[t.trialId] || 0) + 1
    ;(positionOfInstance[t.trialId] ||= new Set()).add(pos + 1)
  })
}
if (!planProblems) pass(`all ${VALID_PLAN_PAIRS.length} plans satisfy every §5.6 constraint`)

const incPct = SCORED_TRIAL_IDS.map((id) => (incorrectCount[id] || 0) / VALID_PLAN_PAIRS.length)
const minPct = Math.min(...incPct), maxPct = Math.max(...incPct)
if (minPct < 0.45 || maxPct > 0.55) fail(`instance-incorrect rate out of range: ${(minPct*100).toFixed(0)}%–${(maxPct*100).toFixed(0)}%`)
else pass(`each instance shown incorrect to ${(minPct*100).toFixed(0)}–${(maxPct*100).toFixed(0)}% of a full cycle`)

const posSpread = SCORED_TRIAL_IDS.map((id) => positionOfInstance[id].size)
if (Math.min(...posSpread) < 4) fail(`an instance occupies only ${Math.min(...posSpread)} distinct positions — order is under-counterbalanced`)
else pass(`each instance occupies ${Math.min(...posSpread)}–${Math.max(...posSpread)} distinct positions (was 1 before O-1)`)

// Correctness must not co-vary with serial position. This is what actually
// matters — the raw schedule-index marginal does not, because complementary
// schedules are what preserve the 50% guarantee.
const posIncorrect = Array(12).fill(0)
for (let i = 0; i < VALID_PLAN_PAIRS.length; i++) {
  generateParticipantTrialPlan(i, getScenarioById, 'c0').forEach((t, pos) => { if (!t.isCorrect) posIncorrect[pos]++ })
}
const posPct = posIncorrect.map((c) => c / VALID_PLAN_PAIRS.length)
if (Math.min(...posPct) < 0.45 || Math.max(...posPct) > 0.55) {
  fail(`correctness co-varies with position: ${(Math.min(...posPct)*100).toFixed(0)}%–${(Math.max(...posPct)*100).toFixed(0)}%`)
} else pass(`every serial position is incorrect ${(Math.min(...posPct)*100).toFixed(0)}–${(Math.max(...posPct)*100).toFixed(0)}% of the time`)

// Complement closure is the mechanism behind both 50% guarantees.
const schedUse = {}
for (const pair of VALID_PLAN_PAIRS) schedUse[pair.scheduleIndex] = (schedUse[pair.scheduleIndex] || 0) + 1
let closureOk = true
for (let sIdx = 0; sIdx < 8; sIdx += 2) {
  if ((schedUse[sIdx] || 0) !== (schedUse[sIdx + 1] || 0)) {
    closureOk = false
    fail(`schedule pair s${sIdx}/s${sIdx + 1} not equally represented (${schedUse[sIdx] || 0} vs ${schedUse[sIdx + 1] || 0})`)
  }
}
if (closureOk) pass('every complementary schedule pair is equally represented')

// condition x plan independence
const pairSeen = {}
for (let seq = 1; seq <= 2000; seq++) {
  const a = assignmentForSequence('novice', seq)
  ;(pairSeen[a.planIndex] ||= new Set()).add(a.condition)
}
const collapsed = Object.entries(pairSeen).filter(([, s]) => s.size < 3)
if (collapsed.length) fail(`plan/condition confound: ${collapsed.length} plans meet fewer than 3 conditions`)
else pass('condition and counterbalancing plan are not confounded')

// ── 4. Stimulus integrity ───────────────────────────────────────────────────
console.log('\n4. STIMULI')
const { scenarios, practiceScenarios, getExplanation } = await import(join(ROOT, 'src/scenarios/index.js'))
const LEAK = /instead shows|would be sufficient|would be needed|actually shows|is cost-optimal|but historical|would suffice/i
let stimProblems = 0
for (const s of [...scenarios, ...practiceScenarios]) {
  for (const isCorrect of [true, false]) {
    for (const c of ['c1', 'c2', 'c3']) {
      const e = getExplanation(s, c, isCorrect)
      if (e == null) { fail(`${s.id} ${c} (${isCorrect ? 'correct' : 'incorrect'}): missing explanation`); stimProblems++; continue }
      const text = typeof e === 'string' ? e : JSON.stringify(e)
      if (/TODO/.test(text)) { fail(`${s.id} ${c}: TODO placeholder`); stimProblems++ }
      if (typeof e === 'string' && LEAK.test(e)) { fail(`${s.id} ${c}: reveals the true value / corrected optimum`); stimProblems++ }
    }
  }
  if (!s.isPractice && !s.chartImage) { fail(`${s.id}: no chartImage bound`); stimProblems++ }
  if (!s.numberLine) { fail(`${s.id}: no declared number-line band`); stimProblems++ }
}
if (!stimProblems) pass(`${scenarios.length} scored + ${practiceScenarios.length} practice stimuli clean (no TODOs, no leakage, charts and scales bound)`)

// ── 5. Database ─────────────────────────────────────────────────────────────
console.log('\n5. DATABASE')
if (!process.env.MONGODB_URI) {
  warn('skipped (MONGODB_URI unset)')
} else {
  try {
    const mongoose = (await import('mongoose')).default
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
    pass('connected')

    const TelemetryEvent = (await import(join(ROOT, 'lib/models/TelemetryEvent.js'))).default
    const TrialResult = (await import(join(ROOT, 'lib/models/TrialResult.js'))).default
    const ParticipantMode = (await import(join(ROOT, 'lib/models/ParticipantMode.js'))).default

    // A brand-new database has no collections yet; that is "not bootstrapped",
    // not a broken check.
    const indexesOf = async (Model) => {
      try { return await Model.collection.indexes() } catch { return null }
    }

    const idx = await indexesOf(TelemetryEvent)
    if (idx === null) fail('TelemetryEvent collection does not exist — run scripts/bootstrap-indexes.js')
    else if (idx.find((i) => i.unique && i.key?.eventId === 1)) pass('TelemetryEvent.eventId unique index present (retry de-duplication active)')
    else fail('TelemetryEvent.eventId unique index MISSING — run scripts/bootstrap-indexes.js')

    const trIdx = await indexesOf(TrialResult)
    if (trIdx === null) fail('TrialResult collection does not exist — run scripts/bootstrap-indexes.js')
    else if (trIdx.find((i) => i.unique && i.key?.participantId === 1 && i.key?.trialId === 1)) {
      pass('TrialResult participantId+trialId unique index present')
    } else fail('TrialResult unique index MISSING — run scripts/bootstrap-indexes.js')

    const existing = await ParticipantMode.countDocuments()
    if (existing > 0) warn(`${existing} participant records already exist — confirm this is not leftover test data`)
    else pass('participant collections empty (clean slate)')

    await mongoose.disconnect()
  } catch (err) {
    fail(`database check failed: ${err.message}`)
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
if (failures === 0) {
  console.log(`PREFLIGHT PASSED${warnings ? ` (${warnings} warning${warnings > 1 ? 's' : ''})` : ''}`)
} else {
  console.log(`PREFLIGHT FAILED — ${failures} blocking issue${failures > 1 ? 's' : ''}, ${warnings} warning${warnings === 1 ? '' : 's'}`)
}
process.exit(failures ? 1 : 0)
