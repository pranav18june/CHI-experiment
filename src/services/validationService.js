/**
 * Form Validation & Loose Input Normalization Service
 */

/**
 * Loosely normalizes typed inputs by stripping currency symbols ($), commas (,),
 * whitespace, and decimal values, converting them to clean non-negative integers.
 * Prevents input friction and formatting errors.
 * @param {string|number} input
 * @returns {number|NaN}
 */
export function normalizeNumericInput(input) {
  if (input === '' || input === null || input === undefined) return NaN
  if (typeof input === 'number') return Math.round(Math.max(0, input))

  // Strip dollar signs, commas, spaces, currency symbols
  const cleaned = String(input)
    .replace(/[\$,\s\u00A0]/g, '')
    .trim()

  if (cleaned === '') return NaN

  const parsed = parseFloat(cleaned)
  if (!Number.isFinite(parsed) || parsed < 0) return NaN

  return Math.round(parsed)
}

/**
 * Validates a numeric decision input after loose normalization.
 * @param {string|number} input
 * @returns {{ isValid: boolean, error: string|null, value: number|null }}
 */
export function validateNumericEstimate(input, band = null) {
  const normalized = normalizeNumericInput(input)

  if (Number.isNaN(normalized)) {
    return { isValid: false, error: 'Please enter a valid amount.', value: null }
  }

  // The slider is clamped to the scenario's response band, but the text box was
  // not: any non-negative number was accepted. A single mistyped order of
  // magnitude produces a cost regret large enough to dominate the primary DV,
  // so the same bound applies to both inputs (§5.9).
  if (band && Number.isFinite(band.min) && Number.isFinite(band.max)) {
    if (normalized < band.min || normalized > band.max) {
      const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US')
      return {
        isValid: false,
        error: `Please enter an amount between ${fmt(band.min)} and ${fmt(band.max)}.`,
        value: null,
      }
    }
  }

  return { isValid: true, error: null, value: normalized }
}

/**
 * Validates a Likert scale selection (1 to 7).
 * @param {number|null} value
 * @returns {boolean}
 */
export function validateLikertRating(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7
}

/**
 * Validates mandatory verification check selection.
 * @param {string|null} response
 * @returns {boolean}
 */
export function validateVerificationResponse(response) {
  return response === 'too_high' || response === 'about_right' || response === 'too_low'
}
