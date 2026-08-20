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

    historicalStatistic: {
      label: 'Average demand in past peak weeks',
      value: '$263,500',
    },

    chart: {
      label: 'Historical peak-week sales',
      hint: '10 verified historical holiday-week observations will appear here.',
      data: {
        historicalSeries: 'TODO_CHART_DATA_NV1',
        movingAverage:    'TODO_CHART_DATA_NV1',
        distribution:     'TODO_CHART_DATA_NV1',
        driverOverlay:    'TODO_CHART_DATA_NV1',
      },
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.44' },
      { name: 'Temperature',            weight: '−0.40' },
      { name: 'Fuel price',             weight: '−0.19' },
    ],

    recommendation: {
      correct:   346257,  // cost-optimal ground truth
      incorrect: 242380,  // underestimates holiday peak (-30%)
      active:    242380,
      optimal:   346257,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_NV1',
      c2:
        'While this category does see a holiday increase, the AI treats the upcoming peak as more ' +
        'modest than the historical pattern suggests, recommending a comparatively conservative ' +
        'order of $242,380 for the peak week.',
      c3:
        'This recommendation assumes expected peak-week demand of about $159,600. The historical ' +
        'pattern for this category instead shows an average peak-week demand closer to $263,500 — ' +
        'substantially higher. If the upcoming peak matches that historical pattern, a larger order would be needed.',
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

    metadata: {
      peakWeekDemandMean: 263500,
      criticalRatio:      'TODO_METADATA',
      holidayWeeks:       10,
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

    historicalStatistic: {
      label: 'Average demand in past peak weeks',
      value: '$165,700',
    },

    chart: {
      label: 'Historical peak-week sales',
      hint: 'Verified historical holiday-week sales will appear here.',
      data: {
        historicalSeries: 'TODO_CHART_DATA_NV2',
        movingAverage:    'TODO_CHART_DATA_NV2',
        distribution:     'TODO_CHART_DATA_NV2',
        driverOverlay:    'TODO_CHART_DATA_NV2',
      },
    },

    drivers: [
      { name: 'Holiday-week indicator',       weight: '+0.37' },
      { name: 'Temperature',                  weight: '−0.44' },
      { name: 'Promotional markdown present', weight: '+0.13' },
    ],

    recommendation: {
      correct:   210921,  // cost-optimal ground truth
      incorrect: 274197,  // overestimates peak (+30%)
      active:    274197,
      optimal:   210921,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_NV2',
      c2:
        "Recent signals suggest this category's upcoming peak may run well above its historical " +
        'holiday pattern, possibly due to an active promotional markdown compounding the seasonal effect. ' +
        'The AI recommends a larger order of $274,197 to cover this anticipated stronger peak.',
      c3:
        'This recommendation assumes expected peak-week demand of about $229,000. The historical ' +
        'pattern for this category instead shows an average peak-week demand closer to $165,700 — ' +
        'notably lower. If the upcoming peak matches that historical pattern, a smaller order would be sufficient.',
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
      peakWeekDemandMean: 165700,
      criticalRatio:      'TODO_METADATA',
      holidayWeeks:       'TODO_DATASET',
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

    historicalStatistic: {
      label: 'Average demand in past peak weeks',
      value: '$163,900',
    },

    chart: {
      label: 'Historical peak-week sales',
      hint: 'Verified historical holiday-week sales will appear here.',
      data: {
        historicalSeries: 'TODO_CHART_DATA_NV3',
        movingAverage:    'TODO_CHART_DATA_NV3',
        distribution:     'TODO_CHART_DATA_NV3',
        driverOverlay:    'TODO_CHART_DATA_NV3',
      },
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.37' },
      { name: 'Temperature',            weight: '−0.38' },
      { name: 'Fuel price',             weight: '−0.19' },
    ],

    recommendation: {
      correct:   218222,  // cost-optimal ground truth
      incorrect: 141844,  // underestimates peak (-35%)
      active:    141844,
      optimal:   218222,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_NV3',
      c2:
        "The AI treats this category's upcoming peak as considerably smaller and more predictable " +
        'than its historical pattern, recommending a conservative order of only $141,844 for the peak week.',
      c3:
        'This recommendation assumes expected peak-week demand of about $87,500. The historical ' +
        'pattern for this category instead shows an average peak-week demand closer to $163,900 — ' +
        'substantially higher. If the upcoming peak matches that historical pattern, a larger order would be needed.',
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
      peakWeekDemandMean: 163900,
      criticalRatio:      'TODO_METADATA',
      holidayWeeks:       'TODO_DATASET',
    },
    futureExpansion: {},
  },
]
