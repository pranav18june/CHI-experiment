/**
 * Counterbalanced Presentation Order & Correctness Schedules (Protocol §5.6, §5.11)
 *
 * Two things are counterbalanced across participants, not one:
 *
 *   1. PRESENTATION ORDER (§5.11 "12 scored trials in counterbalanced order").
 *      Previously every participant saw the identical fixed sequence
 *      SS-1…EW-3, which made trial position collinear with scenario instance
 *      (so §7 cannot separate order effects from the scenario random intercept)
 *      and blocked each decision type into consecutive slots (so fatigue and
 *      practice effects mapped straight onto decision type). §13.4 lists that
 *      fixed sequence as a v1 design flaw.
 *
 *   2. CORRECTNESS (§5.6). Position-based, from complementary Latin-square
 *      schedules, so 6 of 12 are correct, no more than two consecutive trials
 *      share a label, and every instance is shown correct to ~half the sample.
 *
 * Constraints guaranteed BY CONSTRUCTION for every participant:
 *   a. All 12 instances appear exactly once.
 *   b. No two consecutive trials share a decision type (types are interleaved).
 *   c. Exactly 6 correct / 6 incorrect.
 *   d. No more than 2 consecutive trials share a correctness label.
 *   e. Among the 6 incorrect trials, exactly 3 are high-direction and 3 low —
 *      so the AI's error direction is never confounded with the participant's
 *      adjustment tendency.
 *   f. Because the valid (order, schedule) set is complement-closed, each
 *      instance is incorrect for exactly half of a full assignment cycle.
 *
 * Only (order, schedule) pairs satisfying (e) are offered — VALID_PLAN_PAIRS,
 * computed once at module load and asserted non-empty.
 */

export const DECISION_TYPES = ['SS', 'NV', 'ROP', 'EW']

export const TYPE_INSTANCES = {
  SS:  ['SS-1', 'SS-2', 'SS-3'],
  NV:  ['NV-1', 'NV-2', 'NV-3'],
  ROP: ['ROP-1', 'ROP-2', 'ROP-3'],
  EW:  ['EW-1', 'EW-2', 'EW-3'],
}

/** Canonical instance list. Presentation order is per participant; this is not it. */
export const SCORED_TRIAL_IDS = [
  'SS-1', 'SS-2', 'SS-3',
  'NV-1', 'NV-2', 'NV-3',
  'ROP-1', 'ROP-2', 'ROP-3',
  'EW-1', 'EW-2', 'EW-3',
]

/** @deprecated Retained only for callers that need the canonical id list. */
export const SCORED_TRIAL_ORDER = SCORED_TRIAL_IDS

export const SCENARIO_ERROR_DIRECTIONS = {
  'SS-1':  'high', // 38026 vs 29251 (+30.0%)
  'SS-2':  'low',  // 34411 vs 49159 (-30.0%)
  'SS-3':  'high', // 90523 vs 67054 (+35.0%)
  'NV-1':  'low',  // 242380 vs 346257 (-30.0%)
  'NV-2':  'high', // 274197 vs 210921 (+30.0%)
  'NV-3':  'low',  // 141844 vs 218222 (-35.0%)
  'ROP-1': 'high', // 9909 vs 7507 (+32.0%)
  'ROP-2': 'low',  // 29601 vs 41112 (-28.0%)
  'ROP-3': 'high', // 22368 vs 16569 (+35.0%)
  'EW-1':  'low',  // 118 vs 181 (-34.8%)
  'EW-2':  'high', // 1438 vs 1106 (+30.0%)
  'EW-3':  'low',  // 172 vs 245 (-29.8%)
}

// ── 8 Counterbalanced Latin-Square Complement Schedules (by POSITION) ────────
// S0/S1, S2/S3, S4/S5, S6/S7 are exact bitwise complements. Each satisfies
// 6-correct/6-incorrect with a maximum run of 2.
export const CORRECTNESS_SCHEDULES = [
  [false, false, true,  false, false, true,  false, true,  true,  false, true,  true ], // S0
  [true,  true,  false, true,  true,  false, true,  false, false, true,  false, false], // S1
  [false, false, true,  false, false, true,  true,  false, true,  true,  false, true ], // S2
  [true,  true,  false, true,  true,  false, false, true,  false, false, true,  false], // S3
  [false, false, true,  false, true,  false, true,  true,  false, true,  false, true ], // S4
  [true,  true,  false, true,  false, true,  false, false, true,  false, true,  false], // S5
  [false, false, true,  false, true,  true,  false, false, true,  true,  false, true ], // S6
  [true,  true,  false, true,  false, false, true,  true,  false, false, true,  false], // S7
]

export const PRESENTATION_ORDER_COUNT = 12

/**
 * Builds presentation order `o` as three rounds of four trials. Each round holds
 * one instance of each decision type, so types are interleaved and no type is
 * ever blocked into consecutive slots. Rotating both the type order and the
 * instance offset by `o` varies which instance sits in which position across
 * participants, while still showing each of the 12 instances exactly once.
 */
export function buildPresentationOrder(orderIndex) {
  const o = ((orderIndex % PRESENTATION_ORDER_COUNT) + PRESENTATION_ORDER_COUNT) % PRESENTATION_ORDER_COUNT
  const sequence = []
  for (let round = 0; round < 3; round++) {
    for (let slot = 0; slot < DECISION_TYPES.length; slot++) {
      const type = DECISION_TYPES[(o + round + slot) % DECISION_TYPES.length]
      const instance = (round + o + DECISION_TYPES.indexOf(type)) % 3
      sequence.push(TYPE_INSTANCES[type][instance])
    }
  }
  return sequence
}

/**
 * (order, schedule) pairs whose incorrect slots hold exactly 3 high-direction
 * and 3 low-direction instances (constraint e). Computed once, then frozen.
 */
function computeValidPlanPairs() {
  const pairs = []
  for (let orderIndex = 0; orderIndex < PRESENTATION_ORDER_COUNT; orderIndex++) {
    const sequence = buildPresentationOrder(orderIndex)
    for (let scheduleIndex = 0; scheduleIndex < CORRECTNESS_SCHEDULES.length; scheduleIndex++) {
      const schedule = CORRECTNESS_SCHEDULES[scheduleIndex]
      const incorrect = sequence.filter((_, i) => !schedule[i])
      const highs = incorrect.filter((id) => SCENARIO_ERROR_DIRECTIONS[id] === 'high').length
      if (incorrect.length === 6 && highs === 3) pairs.push({ orderIndex, scheduleIndex })
    }
  }
  return Object.freeze(pairs)
}

export const VALID_PLAN_PAIRS = computeValidPlanPairs()

if (VALID_PLAN_PAIRS.length === 0) {
  throw new Error('[counterbalance] No valid (order, schedule) pairs — design constraints are unsatisfiable')
}

/** Maps an assignment index onto one of the valid (order, schedule) pairs. */
export function planPairForIndex(planIndex) {
  const n = VALID_PLAN_PAIRS.length
  const i = ((Math.floor(planIndex) % n) + n) % n
  return VALID_PLAN_PAIRS[i]
}

function computeStimulusHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return 'sh_' + Math.abs(hash).toString(16)
}

/**
 * Returns a complete 12-trial plan: presentation order, per-trial correctness,
 * the exact stimulus snapshot, and a content hash for reproducibility.
 *
 * @param {number} planIndex   Index into VALID_PLAN_PAIRS (from the atomic assignment sequence)
 * @param {Function} getScenarioFn  Scenario lookup by id
 * @param {string} condition   'c0' | 'c1' | 'c2' | 'c3'
 */
export function generateParticipantTrialPlan(planIndex, getScenarioFn, condition = 'c0') {
  const { orderIndex, scheduleIndex } = planPairForIndex(planIndex)
  const sequence = buildPresentationOrder(orderIndex)
  const schedule = CORRECTNESS_SCHEDULES[scheduleIndex]

  return sequence.map((trialId, position) => {
    const isCorrect = schedule[position]
    const errorDirection = isCorrect ? 'na' : (SCENARIO_ERROR_DIRECTIONS[trialId] || 'na')

    const scenario = getScenarioFn ? getScenarioFn(trialId) : null
    let recommendation = 0
    let groundTruthOptimal = 0
    let title = ''
    let decisionPrompt = ''
    let context = ''
    let explanationText = null

    if (scenario) {
      groundTruthOptimal = scenario.groundTruthOptimal ??
        (typeof scenario.recommendation === 'object'
          ? (scenario.recommendation.correct ?? scenario.recommendation.optimal)
          : scenario.recommendation)

      recommendation = isCorrect
        ? (scenario.recommendation?.correct ?? scenario.recommendation?.optimal ?? groundTruthOptimal)
        : (scenario.recommendation?.incorrect ?? scenario.recommendation?.active ?? groundTruthOptimal)

      title = scenario.title || ''
      decisionPrompt = scenario.decisionPrompt || scenario.prompt || ''
      context = scenario.context || ''

      // Correct and incorrect trials draw from separate stimulus banks. There is
      // deliberately no cross-correctness fallback: serving the opposite version's
      // text would silently swap the manipulation, so a missing entry snapshots
      // null and surfaces as an absent explanation rather than a wrong one.
      if (condition !== 'c0') {
        const bank = isCorrect ? scenario.correctExplanations : scenario.explanations
        explanationText = bank?.[condition] ?? null
      }
    }

    const rawPayload = JSON.stringify({
      trialId,
      condition,
      isCorrect,
      errorDirection,
      recommendation,
      groundTruthOptimal,
      title,
      decisionPrompt,
      explanationText,
    })

    return {
      trialId,
      orderIndex: position + 1, // 1-based serial position (§7 fixed effect)
      isCorrect,
      errorDirection,
      recommendation,
      groundTruthOptimal,
      title,
      decisionPrompt,
      context,
      explanation: explanationText,
      stimulusContentHash: computeStimulusHash(rawPayload),
    }
  })
}

/**
 * Reduces a stored plan to the fields the browser actually needs to render.
 *
 * The full plan stays in ParticipantTrialPlan (server authority + audit trail),
 * but `groundTruthOptimal`, `isCorrect` and `errorDirection` are never sent to
 * the client. The browser needs only the recommendation and the explanation to
 * draw a trial; since the D-4 change the server resolves correctness and ground
 * truth from its own copy on write and ignores whatever the client reports, so
 * shipping them served no purpose beyond putting the answer key in the
 * participant's local storage.
 */
export function toClientTrialPlan(plan) {
  return (plan || []).map((item) => ({
    trialId: item.trialId,
    orderIndex: item.orderIndex,
    recommendation: item.recommendation,
    explanation: item.explanation,
    title: item.title,
    decisionPrompt: item.decisionPrompt,
    context: item.context,
    stimulusContentHash: item.stimulusContentHash,
  }))
}

/**
 * Verifies every protocol constraint for a generated plan. Used by the test
 * suite and by the deployment preflight check.
 */
export function validateTrialPlan(plan) {
  const problems = []
  const ids = plan.map((t) => t.trialId)

  if (plan.length !== 12) problems.push(`expected 12 trials, got ${plan.length}`)
  if (new Set(ids).size !== ids.length) problems.push('duplicate instances in plan')
  for (const id of SCORED_TRIAL_IDS) if (!ids.includes(id)) problems.push(`missing instance ${id}`)

  const types = ids.map((id) => id.split('-')[0])
  for (let i = 1; i < types.length; i++) {
    if (types[i] === types[i - 1]) { problems.push(`adjacent same decision type at position ${i + 1}`); break }
  }

  const nCorrect = plan.filter((t) => t.isCorrect).length
  if (nCorrect !== 6) problems.push(`expected 6 correct, got ${nCorrect}`)

  let run = 1
  for (let i = 1; i < plan.length; i++) {
    run = plan[i].isCorrect === plan[i - 1].isCorrect ? run + 1 : 1
    if (run > 2) { problems.push(`more than 2 consecutive trials share a correctness label at position ${i + 1}`); break }
  }

  const incorrect = plan.filter((t) => !t.isCorrect)
  const highs = incorrect.filter((t) => t.errorDirection === 'high').length
  const lows = incorrect.filter((t) => t.errorDirection === 'low').length
  if (highs !== 3 || lows !== 3) problems.push(`error direction unbalanced: ${highs} high / ${lows} low`)

  return { valid: problems.length === 0, problems }
}
