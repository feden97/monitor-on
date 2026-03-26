/**
 * Formatting utilities for the ONs Dashboard.
 * All monetary values are in Argentine Pesos (ARS).
 */

const PCT_FORMAT = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
})

/**
 * Format a price value as ARS/USD currency with dynamic decimals.
 * - 'O' tickers >= 1000: 0 decimals
 * - Others: 2 decimals
 */
export function formatPrice(value, symbol = '') {
  if (value == null || isNaN(value)) return '—'
  
  const isPesos = symbol.endsWith('O')
  const decimals = (isPesos && value >= 1000) ? 0 : 2

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS', // The symbol is used even if it's USD because the app is themed in ARS for now
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format a plain number with thousand separators.
 * For volumes/totals, we default to 0 decimals if large.
 */
export function formatNumber(value) {
  if (value == null || isNaN(value)) return '—'
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format a percentage change value (e.g. -0.1 → "-0.10%").
 * Returns '—' for null/undefined.
 */
export function formatPct(value) {
  if (value == null || isNaN(value)) return '—'
  return PCT_FORMAT.format(value) + '%'
}

/**
 * Classify a pct_change value.
 * @returns {'up' | 'down' | 'flat'}
 */
export function getChangeDirection(value) {
  if (value == null || isNaN(value) || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}
