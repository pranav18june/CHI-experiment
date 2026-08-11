/**
 * Reorder Point scenarios — ROP-1, ROP-2, ROP-3
 *
 * Scenario type: Reorder Point
 * Purpose: Determine the inventory level that triggers replenishment.
 * Decision family: Set a dollar-value reorder point.
 *
 * Reorder point formula (for reference only — never shown to participants):
 *   ROP = (average daily demand × average lead time) + safety component
 *
 * Key metadata per scenario (from protocol):
 *   ROP-1  Pet Shop         demand ≈ $296/day   lead time ≈ 11 days  lowest variability
 *   ROP-2  Bed Bath Table   demand ≈ $1,433/day  lead time ≈ 13 days  moderate variability
 *   ROP-3  Office Furniture demand ≈ $376/day    lead time ≈ 21 days  highest variability
 */

const SCENARIO_TYPE  = 'reorderPoint'
const SHORT_LABEL    = 'Reorder point'
const DECISION_LABEL = 'Reorder point'

const DECISION_PROMPT = {
  initial:
    'Based on the historical information above, what reorder point ' +
    '(inventory value in dollars) would you set for this product category?',
  final:
    'Having now seen the AI recommendation, what reorder point ' +
    '(inventory value in dollars) would you set for this product category?',
}

// ─────────────────────────────────────────────────────────────────────────────

export const reorderPointScenarios = [

  // ── ROP-1 · Pet Shop ─────────────────────────────────────────────────────
  // Demand ≈ $296/day, lead time ≈ 11 days, lowest lead-time variability.
  // Lead-time demand base: $296 × 11 = $3,256
  // Correct ROP $7,507 | Incorrect (shown) $9,909 — AI overestimates variability
  {
    id: 'ROP-1',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'easy',

    shortLabel:    SHORT_LABEL,
    title:         'Pet Shop',
    category:      'Animal supplies & accessories',
    description:   'Consistent demand, low lead-time variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Average daily demand',
      value: '~$296',
    },

    chart: {
      label: 'Historical demand and lead-time data',
      hint: 'Daily demand observations and supplier lead-time distribution will appear here.',
      data: {
        historicalSeries:     'TODO_CHART_DATA_ROP1',
        leadTimeDistribution: 'TODO_CHART_DATA_ROP1',
        demandDistribution:   'TODO_CHART_DATA_ROP1',
        deliveryHistory:      'TODO_CHART_DATA_ROP1',
      },
    },

    // C1: factors influencing lead-time demand variability
    drivers: [
      { name: 'Lead-time variability coefficient', weight: '+0.18' },
      { name: 'Demand variability coefficient',    weight: '+0.12' },
      { name: 'Seasonal demand indicator',         weight: '+0.09' },
      { name: 'Supplier reliability score',        weight: '−0.14' },
    ],

    recommendation: {
      correct:   7507,
      incorrect: 9909,   // AI overestimates lead-time variability
      active:    9909,
      optimal:   7507,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_ROP1',
      c2:
        'This pet supply category shows consistent, predictable ordering patterns with the lowest ' +
        'lead-time variability of the three reorder point scenarios. The AI recommends a reorder ' +
        'point of $9,909, which appears to overestimate the combined demand and variability for ' +
        'this category. Based on the historical ordering pattern and relatively stable lead times, ' +
        'a reorder point of around $7,500 may be more appropriate.',
      c3:
        'This recommendation assumes lead-time variability of approximately 4.2 days. The historical ' +
        'data for this supplier instead shows variability closer to 2.1 days — about half as much. ' +
        'If variability matches the historical level, a lower reorder point of approximately $7,507 would be sufficient.',
    },

    metadata: {
      demandMeanPerDay:        296,
      averageLeadTimeDays:     11,
      leadTimeDemandBase:      3256,   // 296 × 11
      variabilityLevel:        'low',
      supplierReliabilityScore: 'TODO_METADATA',
    },
    futureExpansion: {},
  },

  // ── ROP-2 · Bed Bath Table ────────────────────────────────────────────────
  // Demand ≈ $1,433/day, lead time ≈ 13 days, moderate variability.
  // Lead-time demand base: $1,433 × 13 = $18,629
  // Correct ROP $41,112 | Incorrect (shown) $29,601 — AI underestimates demand
  {
    id: 'ROP-2',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'medium',

    shortLabel:    SHORT_LABEL,
    title:         'Bed Bath Table',
    category:      'Home furnishings & accessories',
    description:   'Moderate demand variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Average daily demand',
      value: '~$1,433',
    },

    chart: {
      label: 'Historical demand and lead-time data',
      hint: 'Daily demand observations and supplier lead-time distribution will appear here.',
      data: {
        historicalSeries:     'TODO_CHART_DATA_ROP2',
        leadTimeDistribution: 'TODO_CHART_DATA_ROP2',
        demandDistribution:   'TODO_CHART_DATA_ROP2',
        deliveryHistory:      'TODO_CHART_DATA_ROP2',
      },
    },

    drivers: [
      { name: 'Demand variability coefficient',    weight: '+0.31' },
      { name: 'Lead-time variability coefficient', weight: '+0.27' },
      { name: 'Interstate shipping distance',      weight: '+0.19' },
      { name: 'Supplier reliability score',        weight: '−0.22' },
    ],

    recommendation: {
      correct:   41112,
      incorrect: 29601,  // AI underestimates average daily demand
      active:    29601,
      optimal:   41112,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_ROP2',
      c2:
        'This home goods category shows moderate demand variability with lead times ranging ' +
        'from approximately 10 to 16 days. The AI recommends a reorder point of $29,601, ' +
        'which may underestimate the combined demand and lead-time variability for this supplier. ' +
        'Based on the historical demand of around $1,433 per day, a higher reorder point of ' +
        'approximately $41,000 would better protect against stockout risk.',
      c3:
        'This recommendation assumes average daily demand of approximately $1,100. The historical ' +
        'data for this category instead shows average daily demand closer to $1,433 — about 30% ' +
        'higher. If demand holds at that historical level, a higher reorder point of approximately ' +
        '$41,112 would be needed.',
    },

    metadata: {
      demandMeanPerDay:        1433,
      averageLeadTimeDays:     13,
      leadTimeDemandBase:      18629,  // 1433 × 13
      variabilityLevel:        'moderate',
      supplierReliabilityScore: 'TODO_METADATA',
    },
    futureExpansion: {},
  },

  // ── ROP-3 · Office Furniture ──────────────────────────────────────────────
  // Demand ≈ $376/day, lead time ≈ 21 days, highest variability.
  // Lead-time demand base: $376 × 21 = $7,896
  // Correct ROP $16,569 | Incorrect (shown) $22,368 — AI overestimates variability
  {
    id: 'ROP-3',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'hard',

    shortLabel:    SHORT_LABEL,
    title:         'Office Furniture',
    category:      'Commercial office supplies',
    description:   'Long lead times, highest variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Average lead time',
      value: '~21 days',
    },

    chart: {
      label: 'Historical demand and lead-time data',
      hint: 'Daily demand observations and supplier lead-time distribution will appear here.',
      data: {
        historicalSeries:     'TODO_CHART_DATA_ROP3',
        leadTimeDistribution: 'TODO_CHART_DATA_ROP3',
        demandDistribution:   'TODO_CHART_DATA_ROP3',
        deliveryHistory:      'TODO_CHART_DATA_ROP3',
      },
    },

    drivers: [
      { name: 'Lead-time variability coefficient', weight: '+0.44' },
      { name: 'Demand variability coefficient',    weight: '+0.29' },
      { name: 'Interstate shipping distance',      weight: '+0.21' },
      { name: 'Supplier reliability score',        weight: '−0.18' },
    ],

    recommendation: {
      correct:   16569,
      incorrect: 22368,  // AI overestimates lead-time variability
      active:    22368,
      optimal:   16569,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_ROP3',
      c2:
        'This office furniture category has the longest supplier lead times and highest ' +
        'lead-time variability of the three reorder point scenarios. While the AI recommends ' +
        'a reorder point of $22,368, the historical variability pattern suggests a lower reorder ' +
        'point of around $16,500 may be more cost-effective without significantly increasing stockout risk.',
      c3:
        'This recommendation assumes lead-time variability of approximately 9.1 days. The historical ' +
        'data for this supplier instead shows variability closer to 5.8 days — about 36% lower. ' +
        'If variability matches that historical level, a lower reorder point of approximately ' +
        '$16,569 would be appropriate.',
    },

    metadata: {
      demandMeanPerDay:        376,
      averageLeadTimeDays:     21,
      leadTimeDemandBase:      7896,   // 376 × 21
      variabilityLevel:        'high',
      supplierReliabilityScore: 'TODO_METADATA',
    },
    futureExpansion: {},
  },
]
