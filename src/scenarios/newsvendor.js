/**
 * Newsvendor scenarios — NV-1, NV-2, NV-3
 *
 * Scenario type: Newsvendor / Peak-week ordering
 * Purpose: Determine how much inventory to order for an upcoming peak week.
 * Decision family: Enter a dollar-value order amount.
 */

const SCENARIO_TYPE  = 'newsvendor'
const SHORT_LABEL    = 'Newsvendor'
const DECISION_LABEL = 'Order amount'

const DECISION_PROMPT = {
  initial:
    'Based on the historical information above, how much would you order for the upcoming ' +
    'peak week (in dollars of inventory value)?',
  final:
    'Having now seen the AI recommendation, how much would you order for the upcoming ' +
    'peak week (in dollars of inventory value)?',
}

export const newsvendorScenarios = [

  // ── NV-1 ─────────────────────────────────────────────────────────────────
  {
    id: 'NV-1',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'medium',
    groundTruthOptimal: 346257,

    shortLabel:    SHORT_LABEL,
    title:         'Store 10',
    category:      'Department 72',
    description:   'High holiday demand',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 800000, step: 2500, anchor: 263500 },

    historicalStatistic: {
      label: 'Average demand in past peak weeks',
      value: '$263,500',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/4.png',

    chart: {
      label: 'Historical peak-week sales',
      hint: '10 verified historical holiday-week observations will appear here.',
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.44' },
      { name: 'Temperature',            weight: '−0.40' },
    ],

    recommendation: {
      correct:   346257,  // cost-optimal ground truth
      incorrect: 242380,  // biased AI suggestion (assumed peak demand ≈ $159,600, −30%)
      active:    242380,
      optimal:   346257,
    },

    // Incorrect-version stimulus texts (Appendix A, verbatim).
    // C3 states ONLY the AI's own assumed input as a boundary (§5.3).
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.44' },
          { label: 'Temperature', value: '−0.40' },
        ],
      },
      c2:
        'This category sees only a modest, well-contained holiday lift above its usual level. ' +
        'The AI recommends a measured order of $242,380 for the upcoming peak week.',
      c3:
        'This order is set for expected peak-week demand of about $159,600. The AI would recommend ' +
        'a larger order if the upcoming peak were expected to run higher than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.44' },
          { label: 'Temperature', value: '−0.40' },
        ],
      },
      c2:
        'This category spikes dramatically during holiday weeks, historically more than doubling ordinary demand, and running short in that one week is expensive. The AI recommends ordering $346,257 for the upcoming peak.',
      c3:
        'This order is set for expected peak-week demand of about $263,500. The AI would recommend a smaller order only if the upcoming peak were expected to fall well below that level.',
    },

    // Q* = mu + z x sigma, critical ratio 0.65, z = 0.385 (Appendix B.3).
    metadata: {
      derivation:         'walmart-holiday-week-subset',
      reproducible:       true,
      peakWeekDemandMean: 263476,
      peakWeekDemandStd:  215016,
      criticalRatio:      0.65,
      zScore:             0.385,
      holidayWeeks:       10,
      perturbedParameter: 'peakWeekDemandMean',
      perturbedValue:     159600,
    },
    futureExpansion: {},
  },

  // ── NV-2 ─────────────────────────────────────────────────────────────────
  {
    id: 'NV-2',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'medium',
    groundTruthOptimal: 210921,

    shortLabel:    SHORT_LABEL,
    title:         'Store 4',
    category:      'Department 72',
    description:   'Moderate holiday lift',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 350000, step: 1000, anchor: 165700 },

    historicalStatistic: {
      label: 'Average demand in past peak weeks',
      value: '$165,700',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/5.png',

    chart: {
      label: 'Historical peak-week sales',
      hint: 'Verified historical holiday-week sales will appear here.',
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.37' },
      { name: 'Temperature',            weight: '−0.44' },
    ],

    recommendation: {
      correct:   210921,  // cost-optimal ground truth
      incorrect: 274197,  // biased AI suggestion (assumed peak demand ≈ $229,000, +30%)
      active:    274197,
      optimal:   210921,
    },

    // Incorrect-version stimulus texts (Appendix A, verbatim). See NV-1.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.37' },
          { label: 'Temperature', value: '−0.44' },
        ],
      },
      c2:
        "This category's upcoming peak is shaping up to run well above its usual holiday level, " +
        'with a promotional push compounding the seasonal surge. The AI recommends a large order ' +
        'of $274,197 to cover it.',
      c3:
        'This order is set for expected peak-week demand of about $229,000. The AI would recommend ' +
        'a smaller order if the upcoming peak were expected to run closer to its usual level.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.37' },
          { label: 'Temperature', value: '−0.44' },
        ],
      },
      c2:
        'This category shows a clear but moderate holiday lift, historically running somewhat above ordinary weekly demand. The AI recommends ordering $210,921 for the upcoming peak.',
      c3:
        'This order is set for expected peak-week demand of about $165,700. The AI would recommend a larger order only if the upcoming peak were expected to run well above that level.',
    },

    metadata: {
      derivation:         'walmart-holiday-week-subset',
      reproducible:       true,
      peakWeekDemandMean: 165676,
      peakWeekDemandStd:  117520,
      criticalRatio:      0.65,
      zScore:             0.385,
      holidayWeeks:       10,
      perturbedParameter: 'peakWeekDemandMean',
      perturbedValue:     229000,
    },
    futureExpansion: {},
  },

  // ── NV-3 ─────────────────────────────────────────────────────────────────
  {
    id: 'NV-3',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'hard',
    groundTruthOptimal: 218222,

    shortLabel:    SHORT_LABEL,
    title:         'Store 14',
    category:      'Department 72',
    description:   'Highly variable holiday sales',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 600000, step: 2500, anchor: 163900 },

    historicalStatistic: {
      label: 'Average demand in past peak weeks',
      value: '$163,900',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/6.png',

    chart: {
      label: 'Historical peak-week sales',
      hint: 'Verified historical holiday-week sales will appear here.',
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.37' },
      { name: 'Temperature',            weight: '−0.38' },
    ],

    recommendation: {
      correct:   218222,  // cost-optimal ground truth
      incorrect: 141844,  // biased AI suggestion (assumed peak demand ≈ $87,500, −35%)
      active:    141844,
      optimal:   218222,
    },

    // Incorrect-version stimulus texts (Appendix A, verbatim). See NV-1.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.37' },
          { label: 'Temperature', value: '−0.38' },
        ],
      },
      c2:
        "This category's upcoming peak looks small and predictable, close to an ordinary week. " +
        'The AI recommends a lean order of $141,844 for the peak week.',
      c3:
        'This order is set for expected peak-week demand of about $87,500. The AI would recommend ' +
        'a larger order if the upcoming peak were expected to run higher than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.37' },
          { label: 'Temperature', value: '−0.38' },
        ],
      },
      c2:
        'This category shows a strong but highly uneven holiday pattern — some years spike far higher than others — and a stockout in the peak week is costly. The AI recommends ordering $218,222 to cover a wide range of possible outcomes.',
      c3:
        'This order is set for expected peak-week demand of about $163,900. The AI would recommend a smaller order only if the upcoming peak were expected to fall well below that level.',
    },

    metadata: {
      derivation:         'walmart-holiday-week-subset',
      reproducible:       true,
      peakWeekDemandMean: 163875,
      peakWeekDemandStd:  141160,
      criticalRatio:      0.65,
      zScore:             0.385,
      holidayWeeks:       10,
      perturbedParameter: 'peakWeekDemandMean',
      perturbedValue:     87500,
    },
    futureExpansion: {},
  },
]
