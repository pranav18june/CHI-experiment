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
export const workshop = [
  [
    'The task',
    'You will review historical sales information and an AI recommendation, then make an inventory decision. You are not required to follow the AI.',
  ],
  [
    'The chart',
    'It shows real historical sales or demand data for a single store and product category. Study it carefully before entering your first estimate.',
  ],
  [
    'The AI suggestion',
    'After your initial estimate, you will see the AI recommendation. Some recommendations in this study may not be accurate — use your own judgment.',
  ],
  [
    'How each decision works',
    'Each decision has four steps: your independent estimate, the AI reveal, a quick verification check, then your final answer.',
  ],
]

// ─── Expert walkthrough cards ─────────────────────────────────────────────────
export const expertWalkthrough = [
  [
    'The interface',
    'Each decision shows historical data on the left and your decision controls on the right. You will work through four steps per scenario.',
  ],
  [
    'AI recommendations',
    'After your independent estimate, you will see the AI recommendation. Some recommendations are intentionally inaccurate — apply your professional judgment.',
  ],
  [
    'Your judgment',
    'Use the AI recommendation as one input alongside the historical data. Your initial and final estimates are recorded separately.',
  ],
]
