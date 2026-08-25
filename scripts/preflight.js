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

// The admin secret guards the full participant dataset and the de-identified
// export, so length alone is not enough: a memorable phrase of 16+ characters
// passes a length check and is still trivially guessable.
function weakSecretReason(v) {
  const lower = v.toLowerCase()
  if (v.length < 20) return `only ${v.length} chars; use 20+`
  if (/^(study-admin|password|admin|changeme|secret)/i.test(v)) return 'starts with a common placeholder word'
  if (/^(.+?)\1{2,}$/.test(lower)) return 'is a short string repeated (e.g. "meowmeowmeowmeow")'
  if (/^[a-z]+$/.test(lower)) return 'is all lowercase letters — no digits or symbols'
  if (new Set(lower).size < 10) return `uses only ${new Set(lower).size} distinct characters`
  if (/(password|secret|admin|study|thisis|itsa)/i.test(lower)) return 'contains a dictionary word a guesser would try'
  return null
}
const secret = process.env.ADMIN_SECRET
if (!secret) fail('ADMIN_SECRET is not set — admin API will refuse all access (503)')
else {
  const weak = weakSecretReason(secret)
  if (weak) fail(`ADMIN_SECRET is weak: it ${weak}. Generate one with: openssl rand -base64 32`)
  else pass('ADMIN_SECRET set and sufficiently strong')
}

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
    if (/TODO_(DEBRIEF_TEXT|INCENTIVE_COPY|ETHICS_COPY|COMPLETION_COPY)/.test(bundle)) {
      fail('built bundle still contains participant-facing TODO copy')
    } else pass('no participant-facing TODO copy in bundle')
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

// ── 2b. Participant-facing study facts (§5.10, §5.11, §11) ──────────────────
console.log('\n2b. CONSENT / DEBRIEF FACTS')
const { missingStudyCopy, STUDY_COPY } = await import(join(ROOT, 'src/config/studyCopy.js'))
const missingCopy = missingStudyCopy()
if (missingCopy.length) {
  fail(`${missingCopy.length} required field(s) unfilled in src/config/studyCopy.js:`)
  for (const f of missingCopy) console.log(`      · ${f}`)
  console.log('      A consent form naming no ethics approval and no contact is not a')
  console.log('      consent form, and a debrief nobody can act on does not discharge a')
  console.log('      deception study\'s duty to its participants.')
} else {
  pass('every required consent/debrief fact is filled')
  pass(`ethics approval: ${STUDY_COPY.ethicsCommittee} (${STUDY_COPY.ethicsApprovalRef})`)
  pass(`participant contact: ${STUDY_COPY.contactEmail}`)
}
if (/\d/.test(STUDY_COPY.estimatedDuration)) pass(`advertised duration: ${STUDY_COPY.estimatedDuration} — confirm against pilot timings`)

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

// ── 4b. Optimizer reproducibility (§5.4, Appendix B) ────────────────────────
console.log('\n4b. OPTIMIZER REPRODUCIBILITY')
const { optimumFor, perturbedFor } = await import(join(ROOT, 'lib/optimizers.js'))
let irreproducible = 0, maxErr = 0
for (const s of scenarios) {
  if (s.metadata?.reproducible !== true) {
    fail(`${s.id}: not marked reproducible — value is not derived from data`)
    irreproducible++
    continue
  }
  const o = optimumFor(s), p = perturbedFor(s)
  if (o == null || p == null) { fail(`${s.id}: optimizer could not recompute`); irreproducible++; continue }
  const eo = Math.abs(o - s.groundTruthOptimal) / s.groundTruthOptimal
  const ep = Math.abs(p - s.recommendation.incorrect) / s.recommendation.incorrect
  maxErr = Math.max(maxErr, eo, ep)
  if (eo > 0.005) { fail(`${s.id}: stored optimum ${s.groundTruthOptimal} vs computed ${Math.round(o)}`); irreproducible++ }
  if (ep > 0.005) { fail(`${s.id}: stored incorrect ${s.recommendation.incorrect} vs computed ${Math.round(p)}`); irreproducible++ }
}
if (!irreproducible) {
  pass(`all ${scenarios.length} optima and perturbations recompute from stored parameters (max ${(maxErr*100).toFixed(2)}% drift)`)
}
// The perturbation must stay inside the pre-registered band and keep 3 high / 3 low.
const offs = scenarios.map((s) => (s.recommendation.incorrect - s.groundTruthOptimal) / s.groundTruthOptimal)
const outOfBand = offs.filter((o) => Math.abs(o) < 0.25 || Math.abs(o) > 0.40).length
if (outOfBand) fail(`${outOfBand} perturbation(s) outside the 25-40% band (§5.6)`)
else pass(`every perturbation within 25-40% (${(Math.min(...offs.map(Math.abs))*100).toFixed(0)}-${(Math.max(...offs.map(Math.abs))*100).toFixed(0)}%)`)
const highs = offs.filter((o) => o > 0).length
if (highs !== offs.length / 2) fail(`error direction unbalanced: ${highs} high of ${offs.length}`)
else pass(`error direction balanced: ${highs} high / ${offs.length - highs} low`)

// §5.3 / §12 item 20: the participant must be able to verify the C3 boundary
// against information that is actually on screen, so the surfaced statistic has
// to describe the same quantity the incorrect version perturbs.
const SURFACED_FOR = {
  demandStd:                 /demand variation|volatility/i,
  peakWeekDemandMean:        /peak week/i,
  leadTimeStdDays:           /delivery-time variability/i,
  dailyDemandMean:           /average daily demand/i,
  revenueLostPerStockoutDay: /revenue at risk/i,
  delayDaysWhenLate:         /delay when a shipment is late/i,
  lateDeliveryProbability:   /late delivery rate/i,
}
let misaligned = 0
for (const s of scenarios) {
  const pp = s.metadata?.perturbedParameter
  const re = SURFACED_FOR[pp]
  if (!pp) { fail(`${s.id}: no perturbedParameter recorded`); misaligned++; continue }
  if (!re || !re.test(s.historicalStatistic?.label || '')) {
    fail(`${s.id}: surfaced "${s.historicalStatistic?.label}" does not describe perturbed "${pp}"`)
    misaligned++
  }
}
if (!misaligned) pass('every trial surfaces the parameter its incorrect version perturbs')

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
