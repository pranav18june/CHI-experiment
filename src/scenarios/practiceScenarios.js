/**
 * Practice scenarios — PRAC-1 (Safety Stock) & PRAC-2 (Newsvendor)
 *
 * Practice trials use the identical scenario schema as scored trials.
 * Practice trials show cost-optimal feedback after Step 4, whereas scored trials do not.
 */

export const practiceScenarios = [
  {
    id: 'PRAC-1',
    scenarioType: 'safetyStock',
    isPractice: true,
    difficulty: 'easy',

    shortLabel:    'Safety stock buffer',
    title:         'Practice Store A',
    category:      'Practice Category',
    description:   'Orientation practice scenario',
    decisionLabel: 'Safety stock level',
    decisionPrompt: {
      initial: 'Based on the historical information above, what safety stock level (in dollars of inventory value) would you set for this product category?',
      final:   'Having now seen the AI recommendation, what safety stock level (in dollars of inventory value) would you set for this product category?',
    },

    historicalStatistic: {
      label: 'Average weekly demand variability',
      value: '$15,000',
    },

    chart: {
      label: 'Weekly sales history',
      hint: 'Practice historical chart data will appear here.',
      data: {
        historicalSeries: 'TODO_CHART_DATA_PRAC1',
        movingAverage:    'TODO_CHART_DATA_PRAC1',
        distribution:     'TODO_CHART_DATA_PRAC1',
        driverOverlay:    'TODO_CHART_DATA_PRAC1',
      },
    },

    drivers: [
      { name: 'Promotional markdown present', weight: '+0.25' },
      { name: 'Temperature',                 weight: '−0.20' },
    ],

    recommendation: {
      correct:   25000,
      incorrect: 32000,
      active:    32000,
      optimal:   25000,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_PRAC1',
      c2: 'This practice scenario demonstrates how demand fluctuations influence safety stock recommendations.',
      c3: 'This practice recommendation assumes higher demand volatility than the historical series indicates.',
    },

    metadata: {
      isPracticePlaceholder: true,
    },
    futureExpansion: {},
  },

  {
    id: 'PRAC-2',
    scenarioType: 'newsvendor',
    isPractice: true,
    difficulty: 'easy',

    shortLabel:    'Newsvendor',
    title:         'Practice Store B',
    category:      'Practice Category',
    description:   'Orientation practice scenario',
    decisionLabel: 'Order amount',
    decisionPrompt: {
      initial: 'Based on the historical information above, how much would you order for the upcoming peak week (in dollars of inventory value)?',
      final:   'Having now seen the AI recommendation, how much would you order for the upcoming peak week (in dollars of inventory value)?',
    },

    historicalStatistic: {
      label: 'Average historical peak-week demand',
      value: '$180,000',
    },

    chart: {
      label: 'Historical peak-week sales',
      hint: 'Practice historical peak-week sales will appear here.',
      data: {
        historicalSeries: 'TODO_CHART_DATA_PRAC2',
        movingAverage:    'TODO_CHART_DATA_PRAC2',
        distribution:     'TODO_CHART_DATA_PRAC2',
        driverOverlay:    'TODO_CHART_DATA_PRAC2',
      },
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.40' },
      { name: 'Fuel price',             weight: '−0.15' },
    ],

    recommendation: {
      correct:   200000,
      incorrect: 150000,
      active:    150000,
      optimal:   200000,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_PRAC2',
      c2: 'This practice scenario demonstrates peak-week order planning.',
      c3: 'This practice recommendation assumes peak demand lower than historical peak observations.',
    },

    metadata: {
      isPracticePlaceholder: true,
    },
    futureExpansion: {},
  },
]
