/**
 * Currency & Formatting Utilities
 */

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/**
 * Formats a numeric value as US Dollar currency ($12,345).
 * @param {number|string} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const numeric = Number(amount)
  if (!Number.isFinite(numeric)) return '$0'
  return usdFormatter.format(numeric)
}

/**
 * Calculates percentage progress (0 to 100).
 * @param {number} current
 * @param {number} total
 * @returns {number}
 */
export function calculateProgress(current, total) {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)))
}
