/**
 * Formatting utilities for the ONs Dashboard.
 * All monetary values are in Argentine Pesos (ARS).
 */

const PCT_FORMAT = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
})

const PCT_SIMPLE_FORMAT = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Cached Intl.NumberFormat instances to avoid re-creating them on every render.
// With ~487 instruments × 3 price columns, this saves thousands of allocations per cycle.
const PRICE_FORMAT_0 = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const PRICE_FORMAT_2 = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format a price value as ARS/USD currency with dynamic decimals.
 * - 'O' tickers >= 1000: 0 decimals
 * - Others: 2 decimals
 */
export function formatPrice(value, symbol = '') {
  if (value == null || isNaN(value)) return '—'
  
  const isPesos = symbol.endsWith('O')
  const useZeroDecimals = isPesos && value >= 1000

  return (useZeroDecimals ? PRICE_FORMAT_0 : PRICE_FORMAT_2).format(value)
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
 * Format a percentage without forcing the '+' sign.
 * Uses a normal minus sign for negative numbers.
 */
export function formatPctSimple(value) {
  if (value == null || isNaN(value)) return '—'
  return PCT_SIMPLE_FORMAT.format(value) + '%'
}

/**
 * Classify a pct_change value.
 * @returns {'up' | 'down' | 'flat'}
 */
export function getChangeDirection(value) {
  if (value == null || isNaN(value) || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

/**
 * Format a 'YYYY-MM-DD' date string into 'DD/MM/YYYY'
 */
export function formatDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '—'
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}
