/**
 * Practice scenarios — PRAC-1 (Safety Stock) & PRAC-2 (Newsvendor)
 *
 * Configured exactly according to protocol specification:
 *   PRAC-1: "Product Category X" (Safety Stock-style, AI correct = $15,000)
 *   PRAC-2: "Product Category Y" (Newsvendor-style, AI incorrect = $60,000 vs optimal $86,000)
 */

export const practiceScenarios = [
  // ── Practice Trial 1 — Product Category X (Safety Stock-style, AI correct) ──
  {
    id: 'PRAC-1',
    scenarioType: 'safetyStock',
    isPractice: true,
    difficulty: 'easy',
    groundTruthOptimal: 15000,

    shortLabel:    'Safety stock buffer',
    title:         'Product Category X',
    category:      'Illustrative category',
    description:   'Low week-to-week volatility',
    decisionLabel: 'Safety stock level',
    decisionPrompt: {
      initial: 'Before seeing any AI input — based on this chart alone, what safety stock level (in dollars) would you set for this product category?',
      final:   "Now that you've seen the AI's recommendation, what is your final answer? You may keep your original estimate, adopt the AI's number, or choose anything in between.",
    },

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 40000, step: 250, anchor: 6450 },

    historicalStatistic: {
      label: 'Weekly demand mean (std dev)',
      value: '$50,000 ($6,450)',
    },

    chartImage: null, // practice uses the illustrative placeholder

    chart: {
      label: 'Weekly sales history for Product Category X',
      hint: 'Constructed weekly sales pattern (3 years illustrative weekly history).',
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.10' },
      { name: 'Temperature',            weight: '−0.15' },
    ],

    recommendation: {
      correct:   15000,
      incorrect: 15000,
      active:    15000,  // AI recommendation shown: $15,000 (correct)
      optimal:   15000,  // Cost-optimal ground truth: $15,000
    },

    // PRAC-1's AI recommendation is the cost-optimal value, so both sets carry
    // the same (correct-version) texts. Same authoring rules as the scored bank:
    // C3 states only the AI's assumed input as a boundary (§5.3).
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.10' },
          { label: 'Temperature', value: '−0.15' },
        ],
      },
      c2: 'This illustrative category shows fairly steady demand from week to week, with a modest uptick during colder weeks. The AI recommends a buffer of $15,000 to absorb ordinary week-to-week swings without tying up excess capital.',
      c3: 'This buffer is set for weekly demand swings of about $6,450. The AI would recommend a larger buffer only if this category\'s week-to-week demand were markedly more volatile than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.10' },
          { label: 'Temperature', value: '−0.15' },
        ],
      },
      c2: 'This illustrative category shows fairly steady demand from week to week, with a modest uptick during colder weeks. The AI recommends a buffer of $15,000 to absorb ordinary week-to-week swings without tying up excess capital.',
      c3: 'This buffer is set for weekly demand swings of about $6,450. The AI would recommend a larger buffer only if this category\'s week-to-week demand were markedly more volatile than that.',
    },

    metadata: {
      derivation:    'illustrative',
      reproducible:  true,
      demandMean:    50000,
      demandStdDev:  6450,
      serviceLevel:  0.95,
      zScore:        1.645,
      leadTimeWeeks: 2,
      perturbedParameter: null,
      perturbedValue:     null,
    },
    futureExpansion: {},
  },

  // ── Practice Trial 2 — Product Category Y (Newsvendor-style, AI incorrect) ──
  {
    id: 'PRAC-2',
    scenarioType: 'newsvendor',
    isPractice: true,
    difficulty: 'easy',
    groundTruthOptimal: 86000,

    shortLabel:    'Newsvendor',
    title:         'Product Category Y',
    category:      'Illustrative category',
    description:   'High variance peak-week demand',
    decisionLabel: 'Order amount',
    decisionPrompt: {
      initial: 'Before seeing any AI input — how much would you order for the upcoming peak week (in dollars)?',
      final:   "Now that you've seen the AI's recommendation, what is your final answer? You may keep your original estimate, adopt the AI's number, or choose anything in between.",
    },

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 200000, step: 1000, anchor: 60000 },

    historicalStatistic: {
      label: 'Holiday-week demand mean (std dev)',
      value: '$60,000 ($67,500)',
    },

    chartImage: null, // practice uses the illustrative placeholder

    chart: {
      label: 'Holiday-week sales history for Product Category Y',
      hint: 'Constructed holiday-week sales pattern (typical week ~$40,000, holiday peak mean $60,000).',
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.40' },
      { name: 'Temperature',            weight: '−0.20' },
    ],

    recommendation: {
      correct:   86000,  // Cost-optimal Q* = $60,000 + 0.385 × $67,500 = $86,000 (critical ratio 0.65)
      incorrect: 60000,  // AI recommendation shown: $60,000 (incorrect — ~30% below optimal)
      active:    60000,
      optimal:   86000,
    },

    // Incorrect-version texts (the $60,000 recommendation implies an assumed
    // peak-week demand of ≈ $34,000). C3 states only that assumed input.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.40' },
          { label: 'Temperature', value: '−0.20' },
        ],
      },
      c2: 'This illustrative category sees only a modest, well-contained holiday lift above its usual level. The AI recommends a measured order of $60,000 for the upcoming peak week.',
      c3: 'This order is set for expected peak-week demand of about $34,000. The AI would recommend a larger order if the upcoming peak were expected to run higher than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.40' },
          { label: 'Temperature', value: '−0.20' },
        ],
      },
      c2: 'This illustrative category spikes sharply during holiday weeks, and past peaks have varied a great deal from year to year. The AI recommends ordering $86,000 to cover a wide range of possible outcomes.',
      c3: 'This order is set for expected peak-week demand of about $60,000. The AI would recommend a smaller order only if the upcoming peak were expected to fall well below that level.',
    },

    metadata: {
      derivation:        'illustrative',
      reproducible:      true,
      typicalWeekMean:   40000,
      holidayWeekMean:   60000,
      holidayWeekStdDev: 67500,
      criticalRatio:     0.65,
      zScore:            0.385,
      perturbedParameter: 'holidayWeekMean',
      perturbedValue:     34000,
    },
    futureExpansion: {},
  },
]
