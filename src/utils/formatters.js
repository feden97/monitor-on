const DASH = '—'

const PCT_FORMAT = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
})

const PCT_SIMPLE_FORMAT = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUMBER_FORMAT = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

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

export function formatPrice(value, symbol = '') {
  if (value == null || Number.isNaN(value)) return DASH

  const isPesos = symbol.endsWith('O')
  const useZeroDecimals = isPesos && value >= 1000

  return (useZeroDecimals ? PRICE_FORMAT_0 : PRICE_FORMAT_2).format(value)
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return DASH
  return NUMBER_FORMAT.format(value)
}

export function formatPct(value) {
  if (value == null || Number.isNaN(value)) return DASH
  return `${PCT_FORMAT.format(value)}%`
}

export function formatPctSimple(value) {
  if (value == null || Number.isNaN(value)) return DASH
  return `${PCT_SIMPLE_FORMAT.format(value)}%`
}

export function getChangeDirection(value) {
  if (value == null || Number.isNaN(value) || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

export function formatDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return DASH

  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return dateStr

  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function formatTime(value, includeSeconds = true) {
  if (!value) return DASH

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return DASH

  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false,
  })
}
