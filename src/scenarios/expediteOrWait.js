/**
 * Expedite or Wait scenarios — EW-1, EW-2, EW-3
 *
 * Scenario type: Expedite or Wait
 * Purpose: Participant decides how much to pay to expedite a shipment.
 * Decision family: Enter a dollar amount to pay for expedited shipping.
 *
 * DERIVATION (Appendix B, extended). Every value below is computed from the
 * Olist Brazilian e-commerce dataset, not chosen:
 *
 *   payment = P(late) × E[delay | late] × revenue lost per day out of stock
 *
 * P(late) is the share of orders delivered after the promised date, E[delay|late]
 * the mean overshoot in days, and the daily figure the category's mean daily
 * order value. Estimated over 2018-02-01 → 2018-08-01, the window the charts
 * display (Olist volume grows 2–4x across the full series).
 *
 * STATED ASSUMPTION: a day out of stock forfeits that day's category revenue —
 * sales are lost, not deferred. Olist records prices but not margins, so any
 * margin-based cost would introduce a parameter absent from the data and
 * unverifiable by a reader. This is the conservative reading and is stated
 * rather than hidden; scaling it by an assumed margin scales all three optima
 * proportionally.
 *
 * Incorrect recommendations are genuine optimizer outputs under one biased
 * input (§5.4/B.4) — the value the C3 counterfactual names.
 * Driver attributions are real Pearson correlations against delivery time.
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
    groundTruthOptimal: 253,

    shortLabel:    SHORT_LABEL,
    title:         'Fashion Bags',
    category:      'Accessories & luggage',
    description:   'Lower-volume category, moderate delay exposure',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    chartImage: '/graphs/10.png',

    numberLine: { min: 0, max: 600, step: 5, anchor: 296 },

    // §5.3 / §12 item 20: surfaced statistic == perturbed parameter.
    historicalStatistic: {
      label: 'Revenue at risk per day out of stock',
      value: '~$296 per day',
    },

    chart: {
      label: 'Historical delay and demand data',
      hint: 'Real weekly order value and delivery dates relative to the promised date.',
    },

    drivers: [
      { name: 'Cross-state shipment',  weight: '+0.46' },
      { name: 'Freight cost per item', weight: '+0.40' },
    ],

    recommendation: {
      correct:   253, // 8.4% late × 10.2 days × $296/day
      incorrect: 165, // same optimizer, daily revenue at risk biased to $192 (−35.0%)
      active:    165,
      optimal:   253,
    },

    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.46' },
          { label: 'Freight cost per item', value: '+0.40' },
        ],
      },
      c2:
        'A day without stock costs this category relatively little while the shipment ' +
        'catches up. The AI recommends paying $165 to expedite — enough to shorten the ' +
        'gap without overspending on freight.',
      c3:
        'This expedite payment is set for about $192 of revenue at risk for each day ' +
        'out of stock. The AI would recommend paying more if a day without stock cost ' +
        'this category more than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.46' },
          { label: 'Freight cost per item', value: '+0.40' },
        ],
      },
      c2:
        'A day without stock costs this category real money while the shipment catches ' +
        'up. The AI recommends paying $253 to expedite and close that gap.',
      c3:
        'This expedite payment is set for about $296 of revenue at risk for each day ' +
        'out of stock. The AI would recommend paying less only if a day without stock ' +
        'cost this category considerably less than that.',
    },

    metadata: {
      derivation:                'olist-2018H1',
      reproducible:              true,
      datasetWindow:             ['2018-02-01', '2018-08-01'],
      sampleSize:                617,
      lateDeliveryProbability:   0.0843,
      delayDaysWhenLate:         10.17,
      revenueLostPerStockoutDay: 295.8,
      costAssumption:            'a day out of stock forfeits that day’s category revenue',
      perturbedParameter:        'revenueLostPerStockoutDay',
      perturbedValue:            192.25,
    },
    futureExpansion: {},
  },

  // ── EW-2 · Auto Parts ────────────────────────────────────────────────────
  {
    id: 'EW-2',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'medium',
    groundTruthOptimal: 1403,

    shortLabel:    SHORT_LABEL,
    title:         'Auto Parts',
    category:      'Replacement components',
    description:   'High-value category, long delays when late',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    chartImage: '/graphs/11.png',

    numberLine: { min: 0, max: 3000, step: 25, anchor: 1450 },

    historicalStatistic: {
      label: 'Typical delay when a shipment is late',
      value: '~11 days',
    },

    chart: {
      label: 'Historical delay and demand data',
      hint: 'Real weekly order value and delivery dates relative to the promised date.',
    },

    drivers: [
      { name: 'Cross-state shipment',  weight: '+0.40' },
      { name: 'Freight cost per item', weight: '+0.29' },
    ],

    recommendation: {
      correct:   1403, // 8.8% late × 11.0 days × $1,450/day
      incorrect: 1824, // same optimizer, delay biased to 14.3 days (+30.0%)
      active:    1824,
      optimal:   1403,
    },

    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.40' },
          { label: 'Freight cost per item', value: '+0.29' },
        ],
      },
      c2:
        'When this route runs late it runs late by a long way, and a workshop waiting ' +
        'on a replacement component absorbs the cost every one of those days. The AI ' +
        'recommends paying $1,824 to expedite and pull the shipment forward.',
      c3:
        'This expedite payment is set for late shipments arriving about 14 days behind ' +
        'the promised date. The AI would recommend paying less if this category ' +
        'recovered more quickly than that when it slipped.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.40' },
          { label: 'Freight cost per item', value: '+0.29' },
        ],
      },
      c2:
        'When this route runs late, a workshop waiting on a replacement component ' +
        'absorbs a real cost for each of those days. The AI recommends paying $1,403 ' +
        'to expedite and pull the shipment forward.',
      c3:
        'This expedite payment is set for late shipments arriving about 11 days behind ' +
        'the promised date. The AI would recommend paying more only if this category ' +
        'slipped considerably further behind than that.',
    },

    metadata: {
      derivation:                'olist-2018H1',
      reproducible:              true,
      datasetWindow:             ['2018-02-01', '2018-08-01'],
      sampleSize:                1943,
      lateDeliveryProbability:   0.0880,
      delayDaysWhenLate:         11.00,
      revenueLostPerStockoutDay: 1449.7,
      costAssumption:            'a day out of stock forfeits that day’s category revenue',
      perturbedParameter:        'delayDaysWhenLate',
      perturbedValue:            14.30,
    },
    futureExpansion: {},
  },

  // ── EW-3 · Electronics ───────────────────────────────────────────────────
  {
    id: 'EW-3',
    scenarioType: SCENARIO_TYPE,
    isPractice: false,
    difficulty: 'hard',
    groundTruthOptimal: 384,

    shortLabel:    SHORT_LABEL,
    title:         'Electronics',
    category:      'Consumer technology',
    description:   'Highest late-delivery rate of the three',
    decisionLabel: DECISION_LABEL,
    decisionPrompt: DECISION_PROMPT,

    chartImage: '/graphs/12.png',

    numberLine: { min: 0, max: 1000, step: 5, anchor: 400 },

    historicalStatistic: {
      label: 'Late delivery rate',
      value: '~11.5% of shipments',
    },

    chart: {
      label: 'Historical delay and demand data',
      hint: 'Real weekly order value and delivery dates relative to the promised date.',
    },

    drivers: [
      { name: 'Cross-state shipment',  weight: '+0.46' },
      { name: 'Freight cost per item', weight: '+0.31' },
    ],

    recommendation: {
      correct:   384, // 11.5% late × 8.4 days × $400/day
      incorrect: 269, // same optimizer, late rate biased to 8.0% (−30.0%)
      active:    269,
      optimal:   384,
    },

    explanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.46' },
          { label: 'Freight cost per item', value: '+0.31' },
        ],
      },
      c2:
        'Shipments in this category usually arrive by the promised date, so the ' +
        'on-shelf date is rarely the one at risk. The AI recommends paying $269 to ' +
        'expedite, covering the occasional slip without paying for speed every time.',
      c3:
        'This expedite payment is set for shipments running late about 8% of the time. ' +
        'The AI would recommend paying more if this category missed its promised date ' +
        'more often than that.',
    },

    correctExplanations: {
      c0: null,
      c1: {
        factors: [
          { label: 'Cross-state shipment', value: '+0.46' },
          { label: 'Freight cost per item', value: '+0.31' },
        ],
      },
      c2:
        'Shipments in this category miss the promised date often enough that the ' +
        'on-shelf date is genuinely at risk. The AI recommends paying $384 to expedite ' +
        'and protect it.',
      c3:
        'This expedite payment is set for shipments running late about 11.5% of the ' +
        'time. The AI would recommend paying less only if this category hit its ' +
        'promised date considerably more reliably than that.',
    },

    metadata: {
      derivation:                'olist-2018H1',
      reproducible:              true,
      datasetWindow:             ['2018-02-01', '2018-08-01'],
      sampleSize:                1369,
      lateDeliveryProbability:   0.1147,
      delayDaysWhenLate:         8.36,
      revenueLostPerStockoutDay: 400.3,
      costAssumption:            'a day out of stock forfeits that day’s category revenue',
      perturbedParameter:        'lateDeliveryProbability',
      perturbedValue:            0.0803,
    },
    futureExpansion: {},
  },
]
