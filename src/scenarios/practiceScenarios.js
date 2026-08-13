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

    shortLabel:    'Safety stock buffer',
    title:         'Product Category X',
    category:      'Illustrative category',
    description:   'Low week-to-week volatility',
    decisionLabel: 'Safety stock level',
    decisionPrompt: {
      initial: 'Before seeing any AI input — based on this chart alone, what safety stock level (in dollars) would you set for this product category?',
      final:   "Now that you've seen the AI's recommendation, what is your final answer? You may keep your original estimate, adopt the AI's number, or choose anything in between.",
    },

    historicalStatistic: {
      label: 'Weekly demand mean (std dev)',
      value: '$50,000 ($6,450)',
    },

    chart: {
      label: 'Weekly sales history for Product Category X',
      hint: 'Constructed weekly sales pattern (3 years illustrative weekly history).',
      data: {
        historicalSeries: 'TODO_CHART_DATA_PRAC1',
        movingAverage:    'TODO_CHART_DATA_PRAC1',
        distribution:     'TODO_CHART_DATA_PRAC1',
        driverOverlay:    'TODO_CHART_DATA_PRAC1',
      },
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

    explanations: {
      c0: null,
      c1: 'Numerical explanation: Review the weekly sales chart and driver weights above. The AI recommendation is $15,000.',
      c2: 'This illustrative category shows fairly steady demand from week to week, with a modest uptick during colder weeks. Because historical volatility here is relatively low, the AI recommends a modest safety stock buffer of $15,000 to cover typical week-to-week swings without tying up excess capital.',
      c3: 'If weekly demand volatility for this category were about 30% higher than the illustrative pattern (near $8,400 instead of the observed $6,450), a buffer of $19,500 would be justified. The illustrative data does not currently support that higher volatility estimate.',
    },

    metadata: {
      demandMean: 50000,
      demandStdDev: 6450,
      leadTimeWeeks: 2,
      zScore: 1.645,
    },
    futureExpansion: {},
  },

  // ── Practice Trial 2 — Product Category Y (Newsvendor-style, AI incorrect) ──
  {
    id: 'PRAC-2',
    scenarioType: 'newsvendor',
    isPractice: true,
    difficulty: 'easy',

    shortLabel:    'Newsvendor',
    title:         'Product Category Y',
    category:      'Illustrative category',
    description:   'High variance peak-week demand',
    decisionLabel: 'Order amount',
    decisionPrompt: {
      initial: 'Before seeing any AI input — how much would you order for the upcoming peak week (in dollars)?',
      final:   "Now that you've seen the AI's recommendation, what is your final answer? You may keep your original estimate, adopt the AI's number, or choose anything in between.",
    },

    historicalStatistic: {
      label: 'Holiday-week demand mean (std dev)',
      value: '$60,000 ($67,500)',
    },

    chart: {
      label: 'Holiday-week sales history for Product Category Y',
      hint: 'Constructed holiday-week sales pattern (typical week ~$40,000, holiday peak mean $60,000).',
      data: {
        historicalSeries: 'TODO_CHART_DATA_PRAC2',
        movingAverage:    'TODO_CHART_DATA_PRAC2',
        distribution:     'TODO_CHART_DATA_PRAC2',
        driverOverlay:    'TODO_CHART_DATA_PRAC2',
      },
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

    explanations: {
      c0: null,
      c1: 'Numerical explanation: Review the holiday-week sales chart and driver weights above. The AI recommendation is $60,000.',
      c2: 'While this illustrative category does see a holiday increase, the AI treats the upcoming peak as more modest than the pattern suggests, recommending a comparatively conservative order of $60,000 for the peak week.',
      c3: 'This recommendation assumes expected peak-week demand of about $34,000. The illustrative pattern for this category instead shows an average peak-week demand closer to $60,000 — substantially higher. If the upcoming peak matches that pattern, a larger order of roughly $86,000 would be needed.',
    },

    metadata: {
      typicalWeekMean: 40000,
      holidayWeekMean: 60000,
      holidayWeekStdDev: 67500,
      criticalRatio: 0.65,
    },
    futureExpansion: {},
  },
]
