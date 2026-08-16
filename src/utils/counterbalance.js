/**
 * Counterbalanced Correctness Schedules & 2×4 Factorial Trial Planner
 *
 * Implements a balanced Latin-square complement design for the 12 scored decision trials.
 *
 * Constraints Enforced:
 *   1. Exactly 6 correct and 6 incorrect AI recommendations per participant.
 *   2. Error direction among incorrect trials is strictly balanced:
 *      - 3 High (+30% to +35% above cost-optimal)
 *      - 3 Low  (-28% to -35% below cost-optimal)
 *   3. Consecutive Run Limit: No more than 2 consecutive trials share the same correctness label.
 *   4. Sample-Wide Balance: 4 complementary schedule pairs (8 total) guarantee that across
 *      the sample, every scenario instance (e.g. SS-1, NV-2) is shown as correct to ~50%
 *      of participants and incorrect to ~50%.
 *   5. Immutable Stimulus Snapshotting: Captures exact stimulus wording, values, and a content
 *      hash to ensure reproducibility across protocol and scenario text updates.
 */

export const SCORED_TRIAL_ORDER = [
  'SS-1', 'SS-2', 'SS-3',
  'NV-1', 'NV-2', 'NV-3',
  'ROP-1', 'ROP-2', 'ROP-3',
  'EW-1', 'EW-2', 'EW-3',
]

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

// ── 8 Counterbalanced Latin-Square Complement Schedules ──────────────────────
// S0/S1, S2/S3, S4/S5, S6/S7 are exact bitwise complements
export const CORRECTNESS_SCHEDULES = [
  // Pair 1
  [false, false, true,  false, false, true,  false, true,  true,  false, true,  true ], // S0
  [true,  true,  false, true,  true,  false, true,  false, false, true,  false, false], // S1 (Complement of S0)

  // Pair 2
  [false, false, true,  false, false, true,  true,  false, true,  true,  false, true ], // S2
  [true,  true,  false, true,  true,  false, false, true,  false, false, true,  false], // S3 (Complement of S2)

  // Pair 3
  [false, false, true,  false, true,  false, true,  true,  false, true,  false, true ], // S4
  [true,  true,  false, true,  false, true,  false, false, true,  false, true,  false], // S5 (Complement of S4)

  // Pair 4
  [false, false, true,  false, true,  true,  false, false, true,  true,  false, true ], // S6
  [true,  true,  false, true,  false, false, true,  true,  false, false, true,  false], // S7 (Complement of S6)
]

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
 * Returns a complete 12-trial plan for a given schedule index, condition, and scenarios lookup.
 */
export function generateParticipantTrialPlan(scheduleIndex, getScenarioFn, condition = 'c0') {
  const schedule = CORRECTNESS_SCHEDULES[scheduleIndex % CORRECTNESS_SCHEDULES.length]

  return SCORED_TRIAL_ORDER.map((trialId, orderIndex) => {
    const isCorrect = schedule[orderIndex]
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

      if (condition !== 'c0' && scenario.explanations) {
        const explObj = scenario.explanations[condition]
        if (explObj) {
          explanationText = isCorrect ? (explObj.correct ?? explObj) : (explObj.incorrect ?? explObj.correct ?? explObj)
        }
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
    const stimulusContentHash = computeStimulusHash(rawPayload)

    return {
      trialId,
      orderIndex: orderIndex + 1,
      isCorrect,
      errorDirection,
      recommendation,
      groundTruthOptimal,
      title,
      decisionPrompt,
      context,
      explanation: explanationText,
      stimulusContentHash,
    }
  })
}
