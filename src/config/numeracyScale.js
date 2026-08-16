/**
 * Validated Numeracy Instrument Configuration (Protocol §5.11 / §6 / Appendix C.3)
 *
 * Default Instrument: Schwartz et al. (1997) & Lipkus et al. (2001) 3-Item Objective Numeracy Battery
 * plus Weller et al. Subjective Numeracy Scale (SNS) items.
 *
 * This configuration is isolated and modular to allow researchers to easily swap out
 * the instrument (e.g. for the Berlin Numeracy Test or Weller 8-item SNS) by updating
 * this configuration file.
 */

export const NUMERACY_INSTRUMENT_NAME = 'Schwartz-Lipkus-3Item-Plus-SNS'

export const NUMERACY_ITEMS = [
  {
    id: 'num_coin_die',
    type: 'numeric_input',
    label: '1. Probability & Probability Distribution',
    prompt:
      'Imagine that we roll a fair, 6-sided die 1,000 times. Out of 1,000 rolls, how many times on average would you expect the die to come up with an even number (2, 4, or 6)?',
    placeholder: 'Enter number of times',
    correctAnswer: 500,
    acceptedRange: [500, 500],
    unit: 'out of 1,000 rolls',
    hint: 'Enter a single integer (e.g. 500)',
  },
  {
    id: 'num_lottery',
    type: 'numeric_input',
    label: '2. Percentage to Absolute Count',
    prompt:
      'In the Big Bucks Lottery, the chances of winning a $10.00 prize are 1%. What is your best guess about how many people would win a $10.00 prize if 1,000 people each buy a single ticket?',
    placeholder: 'Enter number of people',
    correctAnswer: 10,
    acceptedRange: [10, 10],
    unit: 'people out of 1,000',
    hint: 'Enter a single integer (e.g. 10)',
  },
  {
    id: 'num_sweepstakes',
    type: 'numeric_input',
    label: '3. Frequency to Percentage Conversion',
    prompt:
      'In the ACME Publishing Sweepstakes, the chance of winning a car is 1 in 1,000. What percent of tickets to the ACME Publishing Sweepstakes win a car?',
    placeholder: 'Enter percentage (e.g. 0.1)',
    correctAnswer: 0.1,
    acceptedRange: [0.099, 0.101],
    unit: '% of tickets',
    hint: 'Enter a percentage value (e.g. 0.1 or 0.1%)',
  },
  {
    id: 'num_sns_fractions',
    type: 'likert',
    label: '4. Subjective Numeracy Assessment',
    prompt: 'How good are you at working with percentages, ratios, and fractions in quantitative analysis?',
    lowLabel: '1 (Not at all good)',
    highLabel: '7 (Extremely good)',
    scaleMin: 1,
    scaleMax: 7,
  },
]

/**
 * Computes objective numeracy score (0 to 3) and subjective rating from responses.
 */
export function scoreNumeracy(responses = {}) {
  let objectiveScore = 0
  const totalObjective = 3

  // Item 1: Die roll
  const r1 = Number(String(responses.num_coin_die || '').replace(/[^0-9.]/g, ''))
  if (r1 === 500) objectiveScore++

  // Item 2: Lottery
  const r2 = Number(String(responses.num_lottery || '').replace(/[^0-9.]/g, ''))
  if (r2 === 10) objectiveScore++

  // Item 3: Sweepstakes
  const r3 = Number(String(responses.num_sweepstakes || '').replace(/[^0-9.]/g, ''))
  if (Math.abs(r3 - 0.1) < 0.005 || r3 === 1 / 10) objectiveScore++

  // Item 4: SNS
  const subjectiveScore = responses.num_sns_fractions ? Number(responses.num_sns_fractions) : null

  return {
    instrument: NUMERACY_INSTRUMENT_NAME,
    objectiveScore,
    totalObjective,
    subjectiveScore,
  }
}
