/**
 * Reorder Point scenarios — ROP-1, ROP-2, ROP-3
 *
 * Scenario type: Reorder Point
 * Purpose: Determine the inventory level that triggers replenishment.
 * Decision family: Set a dollar-value reorder point.
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

export const reorderPointScenarios = [

  // ── ROP-1 · Pet Shop ─────────────────────────────────────────────────────
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

    drivers: [
      { name: 'Lead-time variability coefficient', weight: '+0.18' },
      { name: 'Demand variability coefficient',    weight: '+0.12' },
      { name: 'Seasonal demand indicator',         weight: '+0.09' },
      { name: 'Supplier reliability score',        weight: '−0.14' },
    ],

    recommendation: {
      correct:   7507,   // cost-optimal ground truth
      incorrect: 9909,   // AI overestimates lead-time variability (+32%)
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

    correctExplanations: {
      c0: null,
      c1: 'Low lead-time variability driver weights (2.1 day standard deviation).',
      c2:
        'With low supplier lead-time variability (averaging 11 days with 2.1-day standard deviation) and steady daily demand ' +
        'of $296, setting a reorder point of $7,507 cost-effectively prevents stockouts without accumulating excess inventory.',
      c3:
        'This recommendation assumes historical lead-time variability of 2.1 days. ' +
        'If lead-time variability doubled to 4.2 days, an ROP of $9,909 would be needed, ' +
        'but historical reliability confirms $7,507 is optimal.',
    },

    metadata: {
      demandMeanPerDay:        296,
      averageLeadTimeDays:     11,
      leadTimeDemandBase:      3256,
      variabilityLevel:        'low',
      supplierReliabilityScore: 'TODO_METADATA',
    },
    futureExpansion: {},
  },

  // ── ROP-2 · Bed Bath Table ────────────────────────────────────────────────
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
      correct:   41112,  // cost-optimal ground truth
      incorrect: 29601,  // AI underestimates average daily demand (-28%)
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

    correctExplanations: {
      c0: null,
      c1: 'Moderate daily demand driver weights ($1,433/day over 13-day lead time).',
      c2:
        'With average daily demand of $1,433 and lead times averaging 13 days (base lead-time demand $18,629), ' +
        'a reorder point of $41,112 accounts for delivery variability and safeguards high-velocity sales.',
      c3:
        'This recommendation is based on true daily demand of $1,433. ' +
        'If daily demand were only $1,100, an ROP of $29,601 would suffice, ' +
        'but $1,433/day demand requires $41,112.',
    },

    metadata: {
      demandMeanPerDay:        1433,
      averageLeadTimeDays:     13,
      leadTimeDemandBase:      18629,
      variabilityLevel:        'moderate',
      supplierReliabilityScore: 'TODO_METADATA',
    },
    futureExpansion: {},
  },

  // ── ROP-3 · Office Furniture ──────────────────────────────────────────────
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
      correct:   16569,  // cost-optimal ground truth
      incorrect: 22368,  // AI overestimates lead-time variability (+35%)
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

    correctExplanations: {
      c0: null,
      c1: 'Long lead-time baseline driver weights (21 days, 5.8 day variability).',
      c2:
        'Accounting for an average lead time of 21 days with 5.8-day variability and $376/day demand, ' +
        'setting a reorder point of $16,569 protects against supply chain delays without ballooning holding costs.',
      c3:
        'This recommendation reflects true lead-time variability of 5.8 days. ' +
        'If variability reached 9.1 days, an ROP of $22,368 would be needed, ' +
        'but historical data demonstrates $16,569 is optimal.',
    },

    metadata: {
      demandMeanPerDay:        376,
      averageLeadTimeDays:     21,
      leadTimeDemandBase:      7896,
      variabilityLevel:        'high',
      supplierReliabilityScore: 'TODO_METADATA',
    },
    futureExpansion: {},
  },
]
