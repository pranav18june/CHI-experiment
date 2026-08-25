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
    groundTruthOptimal: 7507,

    shortLabel:    SHORT_LABEL,
    title:         'Pet Shop',
    category:      'Animal supplies & accessories',
    description:   'Consistent demand, low lead-time variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 24000, step: 100, anchor: 3256 },

    // §5.3 / §12 item 20: the surfaced statistic IS the parameter the incorrect
    // version perturbs, so the C3 boundary can actually be verified against the
    // information on screen.
    historicalStatistic: {
      label: 'Supplier lead-time variability',
      value: '±2.1 days',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/7.png',

    chart: {
      label: 'Historical demand and lead-time data',
      hint: 'Daily demand observations and supplier lead-time distribution will appear here.',
    },

    drivers: [
      { name: 'Lead-time variability coefficient', weight: '+0.18' },
      { name: 'Supplier reliability score',        weight: '−0.14' },
    ],

    recommendation: {
      correct:   7507,   // cost-optimal ground truth
      incorrect: 9909,   // biased AI suggestion (assumed lead-time variability ≈ 4.2 days, +32%)
      active:    9909,
      optimal:   7507,
    },

    // Incorrect-version stimulus texts. Authored to the Appendix A pattern:
    // C3 states ONLY the AI's own assumed input as a boundary — never the true
    // value and never a corrected optimum (§5.3); C2 shares the confident
    // register of its correct counterpart.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Lead-time variability coefficient', value: '+0.18' },
          { label: 'Supplier reliability score', value: '−0.14' },
        ],
      },
      c2:
        'Deliveries for this category arrive on an uneven schedule, with replenishment lead times ' +
        'swinging widely from one order to the next. The AI recommends a reorder point of $9,909 ' +
        'to keep the shelf covered across those longer waits.',
      c3:
        'This reorder point is set for supplier lead times that vary by about 4.2 days. The AI would ' +
        'recommend a lower reorder point if this supplier delivered more consistently than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Lead-time variability coefficient', value: '+0.18' },
          { label: 'Supplier reliability score', value: '−0.14' },
        ],
      },
      c2:
        'This category is replenished on a dependable schedule, with lead times holding close to ' +
        'their usual length and steady day-to-day demand. The AI recommends a reorder point of ' +
        '$7,507 to trigger replenishment in good time without carrying idle stock.',
      c3:
        'This reorder point is set for supplier lead times that vary by about 2.1 days. The AI would ' +
        'recommend a higher reorder point only if this supplier delivered markedly less consistently than that.',
    },

    // CONSTRUCTED instance: not derived from a real dataset. §5.5 lists
    // Reorder-Point as blocked pending a lead-time dataset, so these parameters
    // describe the stimulus rather than reproduce the optimum from a pipeline.
    // `reproducible: false` keeps the §7 sensitivity analysis honest about which
    // rows it can recompute. See PROTOCOL_GAPS_REMAINING.md item B-1.
    metadata: {
      derivation:              'constructed',
      reproducible:            false,
      demandMeanPerDay:        296,
      averageLeadTimeDays:     11,
      leadTimeDemandBase:      3256,
      leadTimeVariabilityDays: 2.1,
      variabilityLevel:        'low',
      perturbedParameter:      'leadTimeVariabilityDays',
      perturbedValue:          4.2,
    },
    futureExpansion: {},
  },

  // ── ROP-2 · Bed Bath Table ────────────────────────────────────────────────
  {
    id: 'ROP-2',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'medium',
    groundTruthOptimal: 41112,

    shortLabel:    SHORT_LABEL,
    title:         'Bed Bath Table',
    category:      'Home furnishings & accessories',
    description:   'Moderate demand variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 60000, step: 250, anchor: 18629 },

    historicalStatistic: {
      label: 'Average daily demand',
      value: '~$1,433',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/8.png',

    chart: {
      label: 'Historical demand and lead-time data',
      hint: 'Daily demand observations and supplier lead-time distribution will appear here.',
    },

    drivers: [
      { name: 'Demand variability coefficient', weight: '+0.31' },
      { name: 'Supplier reliability score',     weight: '−0.22' },
    ],

    recommendation: {
      correct:   41112,  // cost-optimal ground truth
      incorrect: 29601,  // biased AI suggestion (assumed daily demand ≈ $1,100, −28%)
      active:    29601,
      optimal:   41112,
    },

    // Incorrect-version stimulus texts. See ROP-1.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Demand variability coefficient', value: '+0.31' },
          { label: 'Supplier reliability score', value: '−0.22' },
        ],
      },
      c2:
        'This category moves at a measured pace, drawing down a modest amount of stock on a typical ' +
        'day while the supplier restocks on its usual schedule. The AI recommends a reorder point of ' +
        '$29,601 to cover the wait for the next delivery.',
      c3:
        'This reorder point is set for average daily demand of about $1,100. The AI would recommend ' +
        'a higher reorder point if this category sold faster than that on a typical day.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Demand variability coefficient', value: '+0.31' },
          { label: 'Supplier reliability score', value: '−0.22' },
        ],
      },
      c2:
        'This category sells steadily and in volume, drawing down a substantial amount of stock ' +
        'every day the supplier is in transit. The AI recommends a reorder point of $41,112 to ' +
        'cover demand across the full replenishment wait.',
      c3:
        'This reorder point is set for average daily demand of about $1,433. The AI would recommend ' +
        'a lower reorder point only if this category sold considerably more slowly than that on a typical day.',
    },

    // CONSTRUCTED instance: not derived from a real dataset. §5.5 lists
    // Reorder-Point as blocked pending a lead-time dataset, so these parameters
    // describe the stimulus rather than reproduce the optimum from a pipeline.
    // `reproducible: false` keeps the §7 sensitivity analysis honest about which
    // rows it can recompute. See PROTOCOL_GAPS_REMAINING.md item B-1.
    metadata: {
      derivation:              'constructed',
      reproducible:            false,
      demandMeanPerDay:        1433,
      averageLeadTimeDays:     13,
      leadTimeDemandBase:      18629,
      leadTimeVariabilityDays: 3.0,
      variabilityLevel:        'moderate',
      perturbedParameter:      'demandMeanPerDay',
      perturbedValue:          1100,
    },
    futureExpansion: {},
  },

  // ── ROP-3 · Office Furniture ──────────────────────────────────────────────
  {
    id: 'ROP-3',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'hard',
    groundTruthOptimal: 16569,

    shortLabel:    SHORT_LABEL,
    title:         'Office Furniture',
    category:      'Commercial office supplies',
    description:   'Long lead times, highest variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    // §5.9 response scale — anchored to this product's historical demand,
    // never to the optimum or the AI value (see getScenarioScaleBounds).
    // Width is pilot-settable (§12 item 6).
    numberLine: { min: 0, max: 50000, step: 250, anchor: 7896 },

    historicalStatistic: {
      label: 'Supplier lead-time variability',
      value: '±5.8 days',
    },

    // Chart asset bound to the instance id, not to the scenario's position in
    // the array: presentation order is counterbalanced per participant (§5.11),
    // so an index-based lookup would show the wrong chart.
    chartImage: '/graphs/9.png',

    chart: {
      label: 'Historical demand and lead-time data',
      hint: 'Daily demand observations and supplier lead-time distribution will appear here.',
    },

    drivers: [
      { name: 'Lead-time variability coefficient', weight: '+0.44' },
      { name: 'Supplier reliability score',        weight: '−0.18' },
    ],

    recommendation: {
      correct:   16569,  // cost-optimal ground truth
      incorrect: 22368,  // biased AI suggestion (assumed lead-time variability ≈ 9.1 days, +35%)
      active:    22368,
      optimal:   16569,
    },

    // Incorrect-version stimulus texts. See ROP-1.
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Lead-time variability coefficient', value: '+0.44' },
          { label: 'Supplier reliability score', value: '−0.18' },
        ],
      },
      c2:
        'Deliveries in this category already take a long time to arrive, and the arrival dates ' +
        'scatter widely around that long average. The AI recommends a reorder point of $22,368 ' +
        'to stay covered through the most delayed shipments.',
      c3:
        'This reorder point is set for supplier lead times that vary by about 9.1 days. The AI would ' +
        'recommend a lower reorder point if this supplier hit its delivery dates more tightly than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Lead-time variability coefficient', value: '+0.44' },
          { label: 'Supplier reliability score', value: '−0.18' },
        ],
      },
      c2:
        'Deliveries in this category take a long time to arrive, but they land close to their ' +
        'expected date. The AI recommends a reorder point of $16,569 to cover that long but ' +
        'predictable replenishment wait.',
      c3:
        'This reorder point is set for supplier lead times that vary by about 5.8 days. The AI would ' +
        'recommend a higher reorder point only if this supplier missed its delivery dates by ' +
        'substantially more than that.',
    },

    // CONSTRUCTED instance: not derived from a real dataset. §5.5 lists
    // Reorder-Point as blocked pending a lead-time dataset, so these parameters
    // describe the stimulus rather than reproduce the optimum from a pipeline.
    // `reproducible: false` keeps the §7 sensitivity analysis honest about which
    // rows it can recompute. See PROTOCOL_GAPS_REMAINING.md item B-1.
    metadata: {
      derivation:              'constructed',
      reproducible:            false,
      demandMeanPerDay:        376,
      averageLeadTimeDays:     21,
      leadTimeDemandBase:      7896,
      leadTimeVariabilityDays: 5.8,
      variabilityLevel:        'high',
      perturbedParameter:      'leadTimeVariabilityDays',
      perturbedValue:          9.1,
    },
    futureExpansion: {},
  },
]
