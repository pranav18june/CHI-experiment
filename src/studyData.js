// ─── Re-export scenario engine data for backward compatibility ──────────────
import {
  scenarios as newScenarios,
  practiceScenarios as newPracticeScenarios,
  decisionFamilies as newDecisionFamilies,
} from './scenarios/index.js'

export const studyTypes = newDecisionFamilies
export const trials = newScenarios
export const practiceTrials = newPracticeScenarios

// ─── Workshop cards (shown to novices during training) ────────────────────────
//
// Protocol §5.7. Teaches chart-reading and the QUALITATIVE logic only — never
// the formula and never how to compute a dollar answer (target:
// perceptible-but-not-computable). Deliberately neutral in tone: it must not
// tell participants the AI is often wrong or instruct them to scrutinise it.
// The three qualitative rules below are exactly what Appendix C.1 then tests.
export const workshop = [
  [
    'The task',
    'You will review historical sales information for a store and product category, then decide how much inventory to hold or order. You will make each decision yourself.',
  ],
  [
    'Reading the chart',
    'The chart shows real historical sales week by week. Look at two things: the usual level the line sits around, and how far it swings above and below that level from week to week.',
  ],
  [
    'Swings and buffers',
    'The more sales swing from week to week, the harder the next week is to predict — and the larger a buffer has to be to absorb that swing. Steadier demand needs a smaller buffer.',
  ],
  [
    'Peaks and one-off orders',
    'For a single pre-peak order, the peaks matter more than the average. When past peaks were large or varied a lot, the order needs to sit further above the average week.',
  ],
  [
    'The cost of being wrong',
    'The two ways of being wrong do not cost the same. Running short and losing sales costs the business more than holding some extra stock.',
  ],
  [
    'How each decision works',
    'Each decision has four steps: your own estimate, the AI recommendation, a quick check of that recommendation against the chart, then your final answer.',
  ],
]

// ─── Expert walkthrough cards ─────────────────────────────────────────────────
//
// Protocol §5.2/§5.7: experts receive the INTERFACE walkthrough only. No
// training on the decision logic — equalising training would collapse the
// expertise contrast — and the same neutral tone as the novice module.
export const expertWalkthrough = [
  [
    'The interface',
    'Each decision shows historical data on the left and your decision controls on the right. You will work through four steps per scenario.',
  ],
  [
    'The sequence',
    'You commit an independent estimate first. The AI recommendation appears only afterwards, followed by a short check and your final answer.',
  ],
  [
    'Your judgment',
    'Use the AI recommendation as one input alongside the historical data. Your initial and final estimates are recorded separately.',
  ],
]
