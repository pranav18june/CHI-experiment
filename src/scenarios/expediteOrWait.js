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

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 300, step: 5, anchor: null },

    // §5.3 / §12 item 20: surfaced statistic == perturbed parameter.
    historicalStatistic: {
      label: 'Cost of each day out of stock',
      value: '~$1,850 per day',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/10.png',

    chart: {
      label: 'Historical delay and demand data',
      hint: 'Supplier delivery delay history and stockout penalty impact data will appear here.',
    },

    drivers: [
      { name: 'Stockout penalty rate',  weight: '+0.22' },
      { name: 'Carrier transit time',   weight: '−0.11' },
    ],

    recommendation: {
      correct:   181,  // cost-optimal ground truth
      incorrect: 118,  // biased AI suggestion (assumed stockout penalty ≈ $1,200/day, −35%)
      active:    118,
      optimal:   181,
    },

    // Incorrect-version stimulus texts. Authored to the Appendix A pattern:
    // C3 states ONLY the AI's own assumed input as a boundary — never the true
    // value and never a corrected optimum (§5.3); C2 shares the confident
    // register of its correct counterpart.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Stockout penalty rate', value: '+0.22' },
          { label: 'Carrier transit time', value: '−0.11' },
        ],
      },
      c2:
        'An empty shelf in this category costs relatively little while the shipment catches up — ' +
        'shoppers tend to wait or substitute. The AI recommends paying $118 to expedite, enough ' +
        'to shorten the gap without overspending on freight.',
      c3:
        'This expedite payment is set for a stockout cost of about $1,200 for each day the shipment ' +
        'is late. The AI would recommend paying more if a day without stock cost this category more than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Stockout penalty rate', value: '+0.22' },
          { label: 'Carrier transit time', value: '−0.11' },
        ],
      },
      c2:
        'An empty shelf in this category is expensive while the shipment catches up — these are ' +
        'high-margin fashion items shoppers buy elsewhere. The AI recommends paying $181 to ' +
        'expedite and close that gap.',
      c3:
        'This expedite payment is set for a stockout cost of about $1,850 for each day the shipment ' +
        'is late. The AI would recommend paying less only if a day without stock cost this category ' +
        'considerably less than that.',
    },

    // CONSTRUCTED instance: not derived from a real dataset. §5.5 lists
    // Expedite-or-Wait as blocked pending a lead-time dataset, so these parameters
    // describe the stimulus rather than reproduce the optimum from a pipeline.
    // `reproducible: false` keeps the §7 sensitivity analysis honest about which
    // rows it can recompute. See PROTOCOL_GAPS_REMAINING.md item B-1.
    metadata: {
      derivation:              'constructed',
      reproducible:            false,
      lateDeliveryProbability: 0.06,
      stockoutPenaltyPerDay:   1850,
      expediteBaseCost:        181,
      perturbedParameter:      'stockoutPenaltyPerDay',
      perturbedValue:          1200,
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

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 3000, step: 25, anchor: null },

    historicalStatistic: {
      label: 'Typical delay when a shipment is late',
      value: '~3 days',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/11.png',

    chart: {
      label: 'Historical delay and demand data',
      hint: 'Supplier delivery delay history and stockout penalty impact data will appear here.',
    },

    drivers: [
      { name: 'Stockout penalty rate',     weight: '+0.38' },
      { name: 'Late delivery probability', weight: '+0.24' },
    ],

    recommendation: {
      correct:   1106,  // cost-optimal ground truth
      incorrect: 1438,  // biased AI suggestion (assumed delay length ≈ 5 days, +30%)
      active:    1438,
      optimal:   1106,
    },

    // Incorrect-version stimulus texts. See EW-1.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Stockout penalty rate', value: '+0.38' },
          { label: 'Late delivery probability', value: '+0.24' },
        ],
      },
      c2:
        'When this route runs late, it runs late by a long way, and a workshop waiting on a ' +
        'replacement component absorbs the cost every one of those days. The AI recommends ' +
        'paying $1,438 to expedite and pull the shipment forward.',
      c3:
        'This expedite payment is set for late shipments arriving about 5 days behind schedule. ' +
        'The AI would recommend paying less if this route recovered more quickly than that when it slipped.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Stockout penalty rate', value: '+0.38' },
          { label: 'Late delivery probability', value: '+0.24' },
        ],
      },
      c2:
        'When this route runs late it recovers quickly, though a workshop waiting on a replacement ' +
        'component absorbs a real cost for each of those days. The AI recommends paying $1,106 to ' +
        'expedite and pull the shipment forward.',
      c3:
        'This expedite payment is set for late shipments arriving about 3 days behind schedule. ' +
        'The AI would recommend paying more only if this route slipped considerably further behind than that.',
    },

    metadata: {
      derivation:              'constructed',
      reproducible:            false,
      lateDeliveryProbability: 0.08,
      typicalDelayDays:        3,
      stockoutPenaltyPerDay:   2400,
      expediteBaseCost:        1106,
      perturbedParameter:      'typicalDelayDays',
      perturbedValue:          5,
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

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 800, step: 5, anchor: null },

    historicalStatistic: {
      label: 'Late delivery probability',
      value: '~10%',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/12.png',

    chart: {
      label: 'Historical delay and demand data',
      hint: 'Supplier delivery delay history and stockout penalty impact data will appear here.',
    },

    drivers: [
      { name: 'Late delivery probability', weight: '+0.32' },
      { name: 'Carrier transit time',      weight: '−0.14' },
    ],

    recommendation: {
      correct:   245,  // cost-optimal ground truth
      incorrect: 172,  // biased AI suggestion (assumed delay probability ≈ 5%, −30%)
      active:    172,
      optimal:   245,
    },

    // Incorrect-version stimulus texts. See EW-1.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Late delivery probability', value: '+0.32' },
          { label: 'Carrier transit time', value: '−0.14' },
        ],
      },
      c2:
        'Shipments on this route usually arrive when promised, so the launch date is rarely the ' +
        'one at risk. The AI recommends paying $172 to expedite, covering the occasional slip ' +
        'without paying for speed on every shipment.',
      c3:
        'This expedite payment is set for shipments running late about 5% of the time. The AI would ' +
        'recommend paying more if this route missed its delivery date more often than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Late delivery probability', value: '+0.32' },
          { label: 'Carrier transit time', value: '−0.14' },
        ],
      },
      c2:
        'Shipments on this route miss their promised date often enough that a launch is genuinely ' +
        'at risk. The AI recommends paying $245 to expedite and protect the on-shelf date for ' +
        'high-margin electronics.',
      c3:
        'This expedite payment is set for shipments running late about 10% of the time. The AI would ' +
        'recommend paying less only if this route hit its delivery date considerably more reliably than that.',
    },

    metadata: {
      derivation:              'constructed',
      reproducible:            false,
      lateDeliveryProbability: 0.10,
      typicalDelayDays:        4,
      stockoutPenaltyPerDay:   1500,
      expediteBaseCost:        245,
      perturbedParameter:      'lateDeliveryProbability',
      perturbedValue:          0.05,
    },
    futureExpansion: {},
  },
]
