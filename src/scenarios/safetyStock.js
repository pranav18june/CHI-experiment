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
    groundTruthOptimal: 29251,

    shortLabel:    SHORT_LABEL,
    title:         'Store 42',
    category:      'Department 92',
    description:   'Fairly steady demand',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Historical weekly demand variation',
      value: '$12,600',
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

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Promotional markdown present', value: '+0.26' },
          { label: 'Temperature', value: '−0.28' },
        ],
      },
      c2:
        'Demand for this category holds fairly steady from week to week, with only modest lifts during colder weeks and active promotions. The AI recommends a buffer of $29,251 to absorb ordinary week-to-week swings without tying up excess capital.',
      c3:
        "This buffer is set for weekly demand swings of about $12,600. The AI would recommend a larger buffer only if this category's week-to-week demand were markedly more volatile than that.",
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
    groundTruthOptimal: 49159,

    shortLabel:    SHORT_LABEL,
    title:         'Store 13',
    category:      'Department 72',
    description:   'Variable seasonal demand',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Historical weekly demand variation',
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
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.43' },
          { label: 'Temperature', value: '−0.45' },
        ],
      },
      c2:
        'This category swings noticeably from week to week, especially around holiday timing and colder weather. The AI recommends a substantial buffer of $49,159 to cover these sizeable, predictable peaks.',
      c3:
        "This buffer is set for weekly demand swings of about $21,100. The AI would recommend a smaller buffer only if this category's week-to-week demand were considerably steadier than that.",
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
    groundTruthOptimal: 67054,

    shortLabel:    SHORT_LABEL,
    title:         'Store 10',
    category:      'Department 5',
    description:   'High demand variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Historical weekly demand variation',
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
      c1: {
        factors: [
          { label: 'Temperature', value: '−0.47' },
          { label: 'Holiday-week indicator', value: '+0.23' },
        ],
      },
      c2:
        'This category shows the largest week-to-week swings of any seen so far, particularly during colder weeks. The AI recommends a sizeable buffer of $67,054 to cover these substantial, irregular spikes.',
      c3:
        "This buffer is set for weekly demand swings of about $28,800. The AI would recommend a larger buffer only if this category's week-to-week demand were substantially more volatile than that.",
    },

    metadata: {
      demandMean:   'TODO_DATASET',
      demandStd:    28800,
      serviceLevel: 'TODO_METADATA',
    },
    futureExpansion: {},
  },
]
