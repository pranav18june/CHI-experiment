/**
 * Form Validation Service
 */

/**
 * Validates a numeric decision input.
 * @param {string|number} input
 * @returns {{ isValid: boolean, error: string|null }}
 */
export function validateNumericEstimate(input) {
  if (input === '' || input === null || input === undefined) {
    return { isValid: false, error: 'An estimate is required.' }
  }

  const parsed = Number(input)
  if (!Number.isFinite(parsed)) {
    return { isValid: false, error: 'Please enter a valid number.' }
  }

  if (parsed < 0) {
    return { isValid: false, error: 'Estimate cannot be negative.' }
  }

  return { isValid: true, error: null }
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
