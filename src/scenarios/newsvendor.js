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
      label: 'Average historical peak-week demand',
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
      c1: 'Peak holiday demand driver weights calibrated to $263,500 historical average.',
      c2:
        'Historical peak-week demand for this department averages $263,500 across holiday observations. ' +
        'Incorporating seasonal lift and critical fractile margins, an optimal order of $346,257 maximizes expected holiday profit.',
      c3:
        'This recommendation reflects average peak-week demand of $263,500. ' +
        'If expected peak demand were only $159,600, an order of $242,380 would suffice; ' +
        'however, historical holiday volume supports $346,257.',
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
      label: 'Average historical peak-week demand',
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
      c1: 'Moderate holiday lift driver weights calibrated to $165,700 historical base.',
      c2:
        'Historical peak-week sales average $165,700 for this category. Based on markdown performance and margin structure, ' +
        'an order of $210,921 captures expected seasonal demand without generating post-holiday surplus inventory.',
      c3:
        'This recommendation reflects historical peak demand of $165,700. ' +
        'If holiday demand surged to $229,000, an order of $274,197 would be justified, ' +
        'but historical data confirms $210,921 is optimal.',
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
      label: 'Average historical peak-week demand',
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
      c1: 'Variable holiday sales driver weights calibrated to $163,900 base.',
      c2:
        'Despite demand variability across past holiday seasons (averaging $163,900), ordering $218,222 provides ' +
        'optimal peak coverage while balancing underage and overage risks.',
      c3:
        'This recommendation is based on historical peak demand of $163,900. ' +
        'If peak demand dropped to $87,500, a conservative order of $141,844 would be appropriate, ' +
        'but historical data warrants $218,222.',
    },

    metadata: {
      peakWeekDemandMean: 163900,
      criticalRatio:      'TODO_METADATA',
      holidayWeeks:       'TODO_DATASET',
    },
    futureExpansion: {},
  },
]
