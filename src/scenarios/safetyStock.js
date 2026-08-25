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

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 70000, step: 250, anchor: 12600 },

    historicalStatistic: {
      label: 'Historical weekly demand variation',
      value: '$12,600',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/1.png',

    chart: {
      label: 'Weekly sales history',
      hint: '143 weeks of verified historical weekly sales will appear here.',
    },

    drivers: [
      { name: 'Promotional markdown present', weight: '+0.26' },
      { name: 'Temperature',                  weight: '−0.28' },
    ],

    recommendation: {
      correct:   29251,  // cost-optimal ground truth
      incorrect: 38026,  // biased AI suggestion (assumed volatility ≈ $16,300, +30%)
      active:    38026,
      optimal:   29251,
    },

    // Incorrect-version stimulus texts (Appendix A, verbatim).
    // C3 states ONLY the AI's own assumed input as a boundary — never the true
    // value and never a corrected optimum (§5.3). C2 shares the confident
    // register of its correct counterpart; only the number/claim differs.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Promotional markdown present', value: '+0.26' },
          { label: 'Temperature', value: '−0.28' },
        ],
      },
      c2:
        'Cold-weather weeks and promotional periods drive sizeable demand surges for this category, ' +
        'and the swings have been widening. The AI recommends a buffer of $38,026 to stay ahead of ' +
        'these larger surges.',
      c3:
        'This buffer is set for weekly demand swings of about $16,300. The AI would recommend a ' +
        "smaller buffer if this category's week-to-week demand were steadier than that.",
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

    // §7 sensitivity analysis re-runs the primary model against alternative
    // constants, so the inputs behind the optimum must survive into the export.
    // SS = Z x sigma_weekly x sqrt(LT)  (Appendix B.3)
    //
    // groundTruthOptimal is the Appendix A value and stays authoritative for
    // scoring. Recomputing it from these constants agrees to within the
    // protocol's own rounding (<0.02%): SS-1 29,250 vs 29,251; SS-2 49,169 vs
    // 49,159; SS-3 67,061 vs 67,054. Re-derive with the same constants when
    // running the sensitivity analysis rather than mixing the two.
    metadata: {
      derivation:    'walmart-weekly-sales',
      reproducible:  true,
      demandMean:    83498,
      demandStd:     12573,
      serviceLevel:  0.95,
      zScore:        1.645,
      leadTimeWeeks: 2,
      perturbedParameter: 'demandStd',
      perturbedValue:     16300,
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

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 80000, step: 250, anchor: 21100 },

    historicalStatistic: {
      label: 'Historical weekly demand variation',
      value: '$21,100',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/2.png',

    chart: {
      label: 'Weekly sales history',
      hint: 'Verified historical weekly sales will appear here.',
    },

    drivers: [
      { name: 'Holiday-week indicator', weight: '+0.43' },
      { name: 'Temperature',            weight: '−0.45' },
    ],

    recommendation: {
      correct:   49159,  // cost-optimal ground truth
      incorrect: 34411,  // biased AI suggestion (assumed volatility ≈ $14,800, −30%)
      active:    34411,
      optimal:   49159,
    },

    // Incorrect-version stimulus texts (Appendix A, verbatim). See SS-1.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Holiday-week indicator', value: '+0.43' },
          { label: 'Temperature', value: '−0.45' },
        ],
      },
      c2:
        'This category follows a steady, well-behaved weekly pattern with only small deviations ' +
        'around holidays. The AI recommends a lean buffer of $34,411, sufficient for these limited swings.',
      c3:
        'This buffer is set for weekly demand swings of about $14,800. The AI would recommend a ' +
        "larger buffer if this category's week-to-week demand were more volatile than that.",
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
      derivation:    'walmart-weekly-sales',
      reproducible:  true,
      demandMean:    77119,
      demandStd:     21135,
      serviceLevel:  0.95,
      zScore:        1.645,
      leadTimeWeeks: 2,
      perturbedParameter: 'demandStd',
      perturbedValue:     14800,
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

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 110000, step: 500, anchor: 28800 },

    historicalStatistic: {
      label: 'Historical weekly demand variation',
      value: '$28,800',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/3.png',

    chart: {
      label: 'Weekly sales history',
      hint: 'Verified historical weekly sales will appear here.',
    },

    drivers: [
      { name: 'Temperature',            weight: '−0.47' },
      { name: 'Holiday-week indicator', weight: '+0.23' },
    ],

    recommendation: {
      correct:   67054,  // cost-optimal ground truth
      incorrect: 90523,  // biased AI suggestion (assumed volatility ≈ $38,900, +35%)
      active:    90523,
      optimal:   67054,
    },

    // Incorrect-version stimulus texts (Appendix A, verbatim). See SS-1.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Temperature', value: '−0.47' },
          { label: 'Holiday-week indicator', value: '+0.23' },
        ],
      },
      c2:
        'This category is entering an unusually turbulent stretch, with cold-weather demand spikes ' +
        'running larger than ever. The AI recommends an especially large buffer of $90,523 to stay ahead of them.',
      c3:
        'This buffer is set for weekly demand swings of about $38,900. The AI would recommend a ' +
        "smaller buffer if this category's week-to-week demand were steadier than that.",
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
      derivation:    'walmart-weekly-sales',
      reproducible:  true,
      demandMean:    58373,
      demandStd:     28826,
      serviceLevel:  0.95,
      zScore:        1.645,
      leadTimeWeeks: 2,
      perturbedParameter: 'demandStd',
      perturbedValue:     38900,
    },
    futureExpansion: {},
  },
]
