/**
 * Safety Stock scenarios — SS-1, SS-2, SS-3
 *
 * Scenario type: Safety Stock
 * Purpose: Determine the optimal inventory safety buffer.
 * Decision family: Set a dollar-value safety stock level.
 */

const SCENARIO_TYPE  = 'safetyStock'
const SHORT_LABEL    = 'Safety stock buffer'
const DECISION_LABEL = 'Safety stock level'

const DECISION_PROMPT = {
  initial:
    'Based on the historical information above, what safety stock level ' +
    '(in dollars of inventory value) would you set for this product category?',
  final:
    'Having now seen the AI recommendation, what safety stock level ' +
    '(in dollars of inventory value) would you set for this product category?',
}

export const safetyStockScenarios = [

  // ── SS-1 ─────────────────────────────────────────────────────────────────
  {
    id: 'SS-1',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'easy',

    shortLabel:    SHORT_LABEL,
    title:         'Store 42',
    category:      'Department 92',
    description:   'Fairly steady demand',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Average weekly demand variability',
      value: '$12,570',
    },

    chart: {
      label: 'Weekly sales history',
      hint: '143 weeks of verified historical weekly sales will appear here.',
      data: {
        historicalSeries: 'TODO_CHART_DATA_SS1',
        movingAverage:    'TODO_CHART_DATA_SS1',
        distribution:     'TODO_CHART_DATA_SS1',
        driverOverlay:    'TODO_CHART_DATA_SS1',
      },
    },

    drivers: [
      { name: 'Holiday-week indicator',       weight: '+0.16' },
      { name: 'Promotional markdown present', weight: '+0.26' },
      { name: 'Temperature',                  weight: '−0.28' },
      { name: 'Unemployment',                 weight: '−0.27' },
    ],

    recommendation: {
      correct:   29251,  // cost-optimal ground truth
      incorrect: 38026,  // biased AI suggestion (overestimates volatility +30%)
      active:    38026,
      optimal:   29251,
    },

    // Explanations for biased/incorrect AI advice
    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_SS1',
      c2:
        'This product category has recently shown signs of larger swings in demand, ' +
        'with colder weeks and promotional periods driving noticeably higher sales than usual. ' +
        'To guard against this apparent rise in volatility, the AI recommends a larger safety ' +
        'stock buffer of $38,026 than the historical average would suggest.',
      c3:
        'This recommendation assumes weekly demand volatility of about $16,300. The historical ' +
        'data for this category instead shows volatility closer to $12,570 — about 30% lower. ' +
        'If volatility returns to that historical level, a smaller buffer of roughly $29,250 would be sufficient.',
    },

    // Explanations for correct/cost-optimal AI advice
    correctExplanations: {
      c0: null,
      c1: 'Driver weights reflect stable historical demand with moderate seasonal adjustments.',
      c2:
        'This product category exhibits steady historical demand with average weekly variability of $12,570. ' +
        'Based on historical sales stability and standard service level targets, a safety stock buffer of ' +
        '$29,251 cost-optimally balances inventory holding costs against stockout risk.',
      c3:
        'This recommendation is calibrated to the historical weekly demand variability of $12,570. ' +
        'If weekly variability were to increase significantly above $16,000, a larger buffer would be required; ' +
        'however, historical stability confirms $29,251 is cost-optimal.',
    },

    metadata: {
      demandMean:   'TODO_DATASET',
      demandStd:    12570,
      serviceLevel: 'TODO_METADATA',
    },
    futureExpansion: {},
  },

  // ── SS-2 ─────────────────────────────────────────────────────────────────
  {
    id: 'SS-2',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'medium',

    shortLabel:    SHORT_LABEL,
    title:         'Store 13',
    category:      'Department 72',
    description:   'Variable seasonal demand',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Average weekly demand variability',
      value: '$21,100',
    },

    chart: {
      label: 'Weekly sales history',
      hint: 'Verified historical weekly sales will appear here.',
      data: {
        historicalSeries: 'TODO_CHART_DATA_SS2',
        movingAverage:    'TODO_CHART_DATA_SS2',
        distribution:     'TODO_CHART_DATA_SS2',
        driverOverlay:    'TODO_CHART_DATA_SS2',
      },
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.43' },
      { name: 'Temperature',            weight: '−0.45' },
      { name: 'Fuel price',             weight: '−0.21' },
    ],

    recommendation: {
      correct:   49159,  // cost-optimal ground truth
      incorrect: 34411,  // underestimates volatility (-30%)
      active:    34411,
      optimal:   49159,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_SS2',
      c2:
        'Although this category shows some holiday-related sales increases, the AI treats the ' +
        'overall pattern as fairly stable and recommends a comparatively modest safety stock buffer ' +
        'of $34,411, reflecting a smaller expected swing in demand than the historical data actually shows.',
      c3:
        'This recommendation assumes weekly demand volatility of about $14,800. The historical data ' +
        'instead shows volatility closer to $21,100 — about 30% higher. If volatility matches that ' +
        'historical level, a larger buffer of roughly $49,150 would be needed.',
    },

    correctExplanations: {
      c0: null,
      c1: 'Driver weights capture regular seasonal swings and temperature-driven demand shifts.',
      c2:
        'Historical sales for this category demonstrate notable seasonal volatility averaging $21,100 per week. ' +
        'To protect customer service levels during high-volume holiday periods and weather transitions, ' +
        'a safety stock buffer of $49,159 is necessary and cost-optimal.',
      c3:
        'This recommendation accounts for the full historical variability of $21,100. ' +
        'If demand volatility were as low as $14,800, a smaller buffer of $34,411 would suffice; ' +
        'however, historical data confirms $49,159 is required.',
    },

    metadata: {
      demandMean:   'TODO_DATASET',
      demandStd:    21100,
      serviceLevel: 'TODO_METADATA',
    },
    futureExpansion: {},
  },

  // ── SS-3 ─────────────────────────────────────────────────────────────────
  {
    id: 'SS-3',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'hard',

    shortLabel:    SHORT_LABEL,
    title:         'Store 10',
    category:      'Department 5',
    description:   'High demand variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Average weekly demand variability',
      value: '$28,800',
    },

    chart: {
      label: 'Weekly sales history',
      hint: 'Verified historical weekly sales will appear here.',
      data: {
        historicalSeries: 'TODO_CHART_DATA_SS3',
        movingAverage:    'TODO_CHART_DATA_SS3',
        distribution:     'TODO_CHART_DATA_SS3',
        driverOverlay:    'TODO_CHART_DATA_SS3',
      },
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.23' },
      { name: 'Temperature',            weight: '−0.47' },
      { name: 'Fuel price',             weight: '−0.23' },
    ],

    recommendation: {
      correct:   67054,  // cost-optimal ground truth
      incorrect: 90523,  // overestimates volatility (+35%)
      active:    90523,
      optimal:   67054,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_SS3',
      c2:
        'Recent weeks suggest this category may be entering an even more volatile stretch than ' +
        'its historical pattern, with colder-weather demand spikes appearing larger than before. ' +
        'To stay ahead of this apparent shift, the AI recommends a larger safety stock buffer of $90,523.',
      c3:
        'This recommendation assumes weekly demand volatility of about $38,900. The historical data ' +
        'instead shows volatility closer to $28,800 — about 35% lower. If volatility matches that ' +
        'historical level, a smaller buffer of roughly $67,050 would be sufficient.',
    },

    correctExplanations: {
      c0: null,
      c1: 'Driver weights reflect high historical variance calibrated to $28,800/wk demand standard deviation.',
      c2:
        'Given high historical demand variability averaging $28,800 per week, setting a safety stock ' +
        'buffer of $67,054 correctly shields against stockouts while avoiding excessive working capital tie-up.',
      c3:
        'This recommendation is calibrated to the historical variability of $28,800. ' +
        'If demand swings escalated to $38,900, a larger buffer of $90,523 would be warranted; ' +
        'however, historical patterns confirm $67,054 is optimal.',
    },

    metadata: {
      demandMean:   'TODO_DATASET',
      demandStd:    28800,
      serviceLevel: 'TODO_METADATA',
    },
    futureExpansion: {},
  },
]
