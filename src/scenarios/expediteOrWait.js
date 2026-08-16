/**
 * Expedite or Wait scenarios — EW-1, EW-2, EW-3
 *
 * Scenario type: Expedite or Wait
 * Purpose: Participant decides how much to pay to expedite a shipment.
 * Decision family: Enter a dollar amount to pay for expedited shipping.
 */

const SCENARIO_TYPE  = 'expediteOrWait'
const SHORT_LABEL    = 'Expedite decision'
const DECISION_LABEL = 'Expedite payment'

const DECISION_PROMPT = {
  initial:
    'Based on the historical information above, how much would you pay to expedite this shipment (in dollars)?',
  final:
    'Having now seen the AI recommendation, how much would you pay to expedite this shipment (in dollars)?',
}

export const expediteOrWaitScenarios = [

  // ── EW-1 · Fashion Bags ──────────────────────────────────────────────────
  {
    id: 'EW-1',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'easy',
    groundTruthOptimal: 181,

    shortLabel:    SHORT_LABEL,
    title:         'Fashion Bags',
    category:      'Accessories & luggage',
    description:   'Low delay risk, moderate stockout penalty',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Late delivery probability',
      value: '~6%',
    },

    chart: {
      label: 'Historical delay and demand data',
      hint: 'Supplier delivery delay history and stockout penalty impact data will appear here.',
      data: {
        deliveryDelaySeries: 'TODO_CHART_DATA_EW1',
        stockoutPenalty:     'TODO_CHART_DATA_EW1',
        expediteCostCurve:   'TODO_CHART_DATA_EW1',
      },
    },

    drivers: [
      { name: 'Late delivery probability', weight: '+0.15' },
      { name: 'Stockout penalty rate',     weight: '+0.22' },
      { name: 'Freight shipment value',    weight: '+0.18' },
      { name: 'Carrier transit time',      weight: '−0.11' },
    ],

    recommendation: {
      correct:   181,  // cost-optimal ground truth
      incorrect: 118,  // AI underestimates expedite value (-35%)
      active:    118,
      optimal:   181,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_EW1',
      c2:
        'This accessory category experiences late deliveries on roughly 6% of shipments. ' +
        'While the AI recommends a conservative expedite payment of $118, considering the ' +
        'potential margin loss on high-demand fashion items, a slightly higher expedite payment ' +
        'of around $180 provides better protection against delayed shipment costs.',
      c3:
        'This recommendation assumes a stockout penalty of approximately $1,200 per day delayed. ' +
        'The actual business cost of a delayed shipment in this category is closer to $1,850 per day. ' +
        'If penalty costs match that higher historical figure, paying $181 to expedite is cost-optimal.',
    },

    correctExplanations: {
      c0: null,
      c1: 'Late delivery risk driver weights (6% delay probability, $1,850/day penalty).',
      c2:
        'With a 6% probability of supplier delay and stockout penalty costs of $1,850 per delayed day, ' +
        'paying $181 to expedite minimizes expected disruption costs and protects fashion margins.',
      c3:
        'This recommendation reflects a stockout penalty of $1,850/day. ' +
        'If daily penalty costs were only $1,200, paying $118 would be sufficient, ' +
        'but higher true penalties make $181 optimal.',
    },

    metadata: {
      lateDeliveryProbability: 0.06,
      stockoutPenaltyPerDay:   1850,
      expediteBaseCost:        181,
    },
    futureExpansion: {},
  },

  // ── EW-2 · Auto Parts ────────────────────────────────────────────────────
  {
    id: 'EW-2',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'medium',
    groundTruthOptimal: 1106,

    shortLabel:    SHORT_LABEL,
    title:         'Auto Parts',
    category:      'Replacement components',
    description:   'Moderate delay risk, high stockout penalty',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Late delivery probability',
      value: '~8%',
    },

    chart: {
      label: 'Historical delay and demand data',
      hint: 'Supplier delivery delay history and stockout penalty impact data will appear here.',
      data: {
        deliveryDelaySeries: 'TODO_CHART_DATA_EW2',
        stockoutPenalty:     'TODO_CHART_DATA_EW2',
        expediteCostCurve:   'TODO_CHART_DATA_EW2',
      },
    },

    drivers: [
      { name: 'Late delivery probability',    weight: '+0.24' },
      { name: 'Stockout penalty rate',        weight: '+0.38' },
      { name: 'Freight shipment value',       weight: '+0.29' },
      { name: 'Interstate shipping distance', weight: '+0.17' },
    ],

    recommendation: {
      correct:   1106,  // cost-optimal ground truth
      incorrect: 1438,  // AI overestimates required expedite payment (+30%)
      active:    1438,
      optimal:   1106,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_EW2',
      c2:
        'Auto parts shipments carry an 8% late delivery risk with substantial downstream ' +
        'penalties for missing critical components. The AI recommends an expedite payment of ' +
        '$1,438. However, cost analysis indicates that a lower payment of $1,106 secures ' +
        'priority handling without overpaying for unnecessary freight speed.',
      c3:
        'This recommendation assumes expected shipping delays of up to 5 days. Historical ' +
        'carrier data shows actual delays rarely exceed 3 days for this route. ' +
        'Given shorter expected delays, paying $1,106 to expedite is sufficient to mitigate risk.',
    },

    correctExplanations: {
      c0: null,
      c1: 'Moderate delay risk driver weights (8% delay probability, 3-day max delay).',
      c2:
        'Carrying an 8% late delivery risk with expected delays of up to 3 days, paying $1,106 secures ' +
        'priority freight handling and mitigates component shortages without overpaying for express transport.',
      c3:
        'This recommendation reflects carrier delays averaging up to 3 days. ' +
        'If delays regularly reached 5 days, paying $1,438 would be justified, ' +
        'but 3-day delay history confirms $1,106 is optimal.',
    },

    metadata: {
      lateDeliveryProbability: 0.08,
      stockoutPenaltyPerDay:   'TODO_METADATA',
      expediteBaseCost:        1106,
    },
    futureExpansion: {},
  },

  // ── EW-3 · Electronics ───────────────────────────────────────────────────
  {
    id: 'EW-3',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'hard',
    groundTruthOptimal: 245,

    shortLabel:    SHORT_LABEL,
    title:         'Electronics',
    category:      'Consumer technology',
    description:   'Higher delay risk, volatile demand',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    historicalStatistic: {
      label: 'Late delivery probability',
      value: '~10%',
    },

    chart: {
      label: 'Historical delay and demand data',
      hint: 'Supplier delivery delay history and stockout penalty impact data will appear here.',
      data: {
        deliveryDelaySeries: 'TODO_CHART_DATA_EW3',
        stockoutPenalty:     'TODO_CHART_DATA_EW3',
        expediteCostCurve:   'TODO_CHART_DATA_EW3',
      },
    },

    drivers: [
      { name: 'Late delivery probability', weight: '+0.32' },
      { name: 'Stockout penalty rate',     weight: '+0.27' },
      { name: 'Freight shipment value',    weight: '+0.25' },
      { name: 'Carrier transit time',      weight: '−0.14' },
    ],

    recommendation: {
      correct:   245,  // cost-optimal ground truth
      incorrect: 172,  // AI underestimates delay risk penalty (-30%)
      active:    172,
      optimal:   245,
    },

    explanations: {
      c0: null,
      c1: 'TODO_C1_EXPLANATION_EW3',
      c2:
        'Consumer electronics shipments face a 10% late delivery rate — the highest risk level ' +
        'among expedite scenarios. The AI suggests paying $172 to expedite. However, high product ' +
        'margins and strict launch deadlines mean an expedite payment of $245 is warranted to avoid ' +
        'costly stockouts.',
      c3:
        'This recommendation assumes a delay probability of only 5%. Historical tracking for ' +
        'this high-volume electronic route demonstrates a true delay frequency closer to 10%. ' +
        'Accounting for this higher delay likelihood, a $245 expedite payment minimizes expected total cost.',
    },

    correctExplanations: {
      c0: null,
      c1: 'Higher delay frequency driver weights (10% delay probability).',
      c2:
        'Facing a 10% late delivery rate on high-margin consumer electronics, paying $245 for expedited ' +
        'shipment avoids costly missed launch dates and stockout penalties.',
      c3:
        'This recommendation is based on a true 10% delay frequency. ' +
        'If delay risk were only 5%, an expedite payment of $172 would suffice, ' +
        'but 10% risk establishes $245 as cost-optimal.',
    },

    metadata: {
      lateDeliveryProbability: 0.10,
      stockoutPenaltyPerDay:   'TODO_METADATA',
      expediteBaseCost:        245,
    },
    futureExpansion: {},
  },
]
