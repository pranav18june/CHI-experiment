/**
 * Reorder Point scenarios — ROP-1, ROP-2, ROP-3
 *
 * Scenario type: Reorder Point
 * Purpose: Determine the inventory level that triggers replenishment.
 * Decision family: Set a dollar-value reorder point.
 *
 * DERIVATION (Appendix B, extended). Every value below is computed from the
 * Olist Brazilian e-commerce dataset, not chosen:
 *
 *   ROP = d̄·L̄ + z·σ_DL ,  σ_DL = √(L̄·σ_d² + d̄²·σ_L²) ,  z = 1.645 (95% service)
 *
 * d̄ and σ_d are daily order value for the category; L̄ and σ_L are the
 * order-to-delivery time distribution. Estimated over 2018-02-01 → 2018-08-01,
 * a recent window the charts also display: Olist volume grows 2–4x across the
 * full series, so a mean over everything would describe no actual period, and
 * the chart, the surfaced statistic and the ground truth must all describe the
 * same data.
 *
 * Incorrect recommendations are genuine optimizer outputs under one biased
 * input (§5.4/B.4) — the value the C3 counterfactual names.
 * Driver attributions are real Pearson correlations against delivery time.
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
    groundTruthOptimal: 12284,

    shortLabel:    SHORT_LABEL,
    title:         'Pet Shop',
    category:      'Animal supplies & accessories',
    description:   'Steady demand, dependable delivery times',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    chartImage: '/graphs/7.png',

    // §5.9 response scale — anchored to the demand level, never to the optimum.
    numberLine: { min: 0, max: 30000, step: 100, anchor: 5637 },

    // §5.3 / §12 item 20: the surfaced statistic IS the parameter the incorrect
    // version perturbs, so the C3 boundary can be verified against the chart.
    historicalStatistic: {
      label: 'Delivery-time variability',
      value: '±7.6 days',
    },

    chart: {
      label: 'Historical demand and lead-time data',
      hint: 'Real weekly order value and the order-to-delivery time distribution.',
    },

    drivers: [
      { name: 'Cross-state shipment',  weight: '+0.38' },
      { name: 'Freight cost per item', weight: '+0.20' },
    ],

    recommendation: {
      correct:   12284, // d̄·L̄ + z·σ_DL with σ_L = 7.58 days
      incorrect: 16214, // same optimizer, σ_L biased to 12.5 days (+32.0%)
      active:    16214,
      optimal:   12284,
    },

    // Incorrect-version texts. C3 states ONLY the AI's own assumed input (§5.3).
    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.38' },
          { label: 'Freight cost per item', value: '+0.20' },
        ],
      },
      c2:
        'Deliveries for this category arrive on an uneven schedule, with the wait ' +
        'swinging widely from one order to the next. The AI recommends a reorder point ' +
        'of $16,214 to keep the shelf covered across those longer waits.',
      c3:
        'This reorder point is set for delivery times that vary by about 12.5 days. ' +
        'The AI would recommend a lower reorder point if this category were delivered ' +
        'more consistently than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.38' },
          { label: 'Freight cost per item', value: '+0.20' },
        ],
      },
      c2:
        'This category is replenished dependably, with delivery times holding close to ' +
        'their usual length and steady day-to-day demand. The AI recommends a reorder ' +
        'point of $12,284 to trigger replenishment in good time without carrying idle stock.',
      c3:
        'This reorder point is set for delivery times that vary by about 7.6 days. ' +
        'The AI would recommend a higher reorder point only if this category were ' +
        'delivered markedly less consistently than that.',
    },

    metadata: {
      derivation:              'olist-2018H1',
      reproducible:            true,
      datasetWindow:           ['2018-02-01', '2018-08-01'],
      sampleSize:              859,
      dailyDemandMean:         505.2,
      dailyDemandStd:          382.4,
      leadTimeMeanDays:        11.16,
      leadTimeStdDays:         7.58,
      serviceLevel:            0.95,
      zScore:                  1.645,
      perturbedParameter:      'leadTimeStdDays',
      perturbedValue:          12.47,
    },
    futureExpansion: {},
  },

  // ── ROP-2 · Bed Bath Table ────────────────────────────────────────────────
  {
    id: 'ROP-2',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'medium',
    groundTruthOptimal: 60110,

    shortLabel:    SHORT_LABEL,
    title:         'Bed Bath Table',
    category:      'Home furnishings & accessories',
    description:   'High-volume category, moderate delivery variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    chartImage: '/graphs/8.png',

    numberLine: { min: 0, max: 100000, step: 500, anchor: 26908 },

    historicalStatistic: {
      label: 'Average daily demand',
      value: '~$2,190',
    },

    chart: {
      label: 'Historical demand and lead-time data',
      hint: 'Real weekly order value and the order-to-delivery time distribution.',
    },

    drivers: [
      { name: 'Cross-state shipment',  weight: '+0.40' },
      { name: 'Freight cost per item', weight: '+0.18' },
    ],

    recommendation: {
      correct:   60110, // d̄ = $2,188/day
      incorrect: 43279, // same optimizer, d̄ biased to $1,566/day (−28.0%)
      active:    43279,
      optimal:   60110,
    },

    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.40' },
          { label: 'Freight cost per item', value: '+0.18' },
        ],
      },
      c2:
        'This category moves at a measured pace, drawing down a modest amount of stock ' +
        'on a typical day while replenishment runs on its usual schedule. The AI ' +
        'recommends a reorder point of $43,279 to cover the wait for the next delivery.',
      c3:
        'This reorder point is set for average daily demand of about $1,570. The AI ' +
        'would recommend a higher reorder point if this category sold faster than that ' +
        'on a typical day.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.40' },
          { label: 'Freight cost per item', value: '+0.18' },
        ],
      },
      c2:
        'This category sells steadily and in volume, drawing down a substantial amount ' +
        'of stock every day a replenishment is in transit. The AI recommends a reorder ' +
        'point of $60,110 to cover demand across the full wait.',
      c3:
        'This reorder point is set for average daily demand of about $2,190. The AI ' +
        'would recommend a lower reorder point only if this category sold considerably ' +
        'more slowly than that on a typical day.',
    },

    metadata: {
      derivation:              'olist-2018H1',
      reproducible:            true,
      datasetWindow:           ['2018-02-01', '2018-08-01'],
      sampleSize:              4317,
      dailyDemandMean:         2187.6,
      dailyDemandStd:          857.0,
      leadTimeMeanDays:        12.30,
      leadTimeStdDays:         9.12,
      serviceLevel:            0.95,
      zScore:                  1.645,
      perturbedParameter:      'dailyDemandMean',
      perturbedValue:          1565.96,
    },
    futureExpansion: {},
  },

  // ── ROP-3 · Office Furniture ──────────────────────────────────────────────
  {
    id: 'ROP-3',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'hard',
    groundTruthOptimal: 25901,

    shortLabel:    SHORT_LABEL,
    title:         'Office Furniture',
    category:      'Commercial office supplies',
    description:   'Long delivery times, highest variability',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    chartImage: '/graphs/9.png',

    numberLine: { min: 0, max: 60000, step: 250, anchor: 13480 },

    historicalStatistic: {
      label: 'Delivery-time variability',
      value: '±11.1 days',
    },

    chart: {
      label: 'Historical demand and lead-time data',
      hint: 'Real weekly order value and the order-to-delivery time distribution.',
    },

    drivers: [
      { name: 'Cross-state shipment', weight: '+0.43' },
      { name: 'Item price',           weight: '−0.19' },
    ],

    recommendation: {
      correct:   25901, // σ_L = 11.12 days over a 21.3-day average wait
      incorrect: 34966, // same optimizer, σ_L biased to 20.2 days (+35.0%)
      active:    34966,
      optimal:   25901,
    },

    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.43' },
          { label: 'Item price', value: '−0.19' },
        ],
      },
      c2:
        'Deliveries in this category already take a long time to arrive, and the ' +
        'arrival dates scatter widely around that long average. The AI recommends a ' +
        'reorder point of $34,966 to stay covered through the slowest deliveries.',
      c3:
        'This reorder point is set for delivery times that vary by about 20.2 days. ' +
        'The AI would recommend a lower reorder point if this category arrived on a ' +
        'tighter schedule than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.43' },
          { label: 'Item price', value: '−0.19' },
        ],
      },
      c2:
        'Deliveries in this category take a long time to arrive, but they land within ' +
        'a predictable spread of that long average. The AI recommends a reorder point ' +
        'of $25,901 to cover the wait without carrying excess stock.',
      c3:
        'This reorder point is set for delivery times that vary by about 11.1 days. ' +
        'The AI would recommend a higher reorder point only if arrival dates scattered ' +
        'substantially more than that.',
    },

    metadata: {
      derivation:              'olist-2018H1',
      reproducible:            true,
      datasetWindow:           ['2018-02-01', '2018-08-01'],
      sampleSize:              698,
      dailyDemandMean:         631.7,
      dailyDemandStd:          600.2,
      leadTimeMeanDays:        21.34,
      leadTimeStdDays:         11.12,
      serviceLevel:            0.95,
      zScore:                  1.645,
      perturbedParameter:      'leadTimeStdDays',
      perturbedValue:          20.21,
    },
    futureExpansion: {},
  },
]
