/** Explicit civil-date day counts. No financial convention is inferred from 360. */
export const DAY_COUNT_VERSION = 'day-count-1.0.0'

export const DAY_COUNT_CONVENTIONS = Object.freeze([
  Object.freeze({ id: 'ACT/360', label: 'ACT/360 · días reales / 360', denominator: 360 }),
  Object.freeze({ id: 'ACT/365F', label: 'ACT/365F · días reales / 365 fijo', denominator: 365 }),
  Object.freeze({ id: '30E/360', label: '30E/360 · europea', denominator: 360 }),
  Object.freeze({ id: '30U/360', label: '30U/360 · estadounidense, EOM explícito', denominator: 360, requiresEndOfMonth: true }),
  Object.freeze({ id: '30U/360-EOM', label: '30U/360 · con ajuste de fin de febrero', denominator: 360, endOfMonth: true }),
  Object.freeze({ id: '30/360-BOND', label: '30/360 Bond Basis · sin ajuste de febrero', denominator: 360, endOfMonth: false }),
])

const conventions = new Map(DAY_COUNT_CONVENTIONS.map(item => [item.id, item]))
const DAY_MS = 86_400_000

function civil(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${name} must be an ISO civil date (YYYY-MM-DD)`)
  }
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || year > 9999) throw new RangeError(`${name} is outside years 0001..9999`)
  const instant = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`${name} is not a valid civil date`)
  }
  return { year, month, day, epoch: instant.getTime() }
}

function rules(convention, options) {
  if (!conventions.has(convention)) throw new RangeError('Unknown day count; choose an explicit supported convention')
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object')
  if (options.endOfMonth !== undefined && typeof options.endOfMonth !== 'boolean') {
    throw new TypeError('endOfMonth must be a boolean')
  }
  if (convention === '30U/360' && typeof options.endOfMonth !== 'boolean') {
    throw new RangeError('30U/360 requires an explicit endOfMonth boolean')
  }
  if (convention === '30U/360-EOM' && options.endOfMonth === false) {
    throw new RangeError('30U/360-EOM cannot be combined with endOfMonth false')
  }
  if (convention === '30/360-BOND' && options.endOfMonth === true) {
    throw new RangeError('30/360-BOND does not apply the end-of-February rule')
  }
  return conventions.get(convention)
}

function februaryEnd(date) {
  const leap = date.year % 4 === 0 && (date.year % 100 !== 0 || date.year % 400 === 0)
  return date.month === 2 && date.day === (leap ? 29 : 28)
}

/**
 * Days in [start, end), with convention-specific month-end transformations.
 * Ordered dates are mandatory. US month-end rules are directional, therefore
 * this API does not silently swap dates or assume antisymmetry.
 */
export function dayCountDays(start, end, convention, options = {}) {
  rules(convention, options)
  const first = civil(start, 'start')
  const last = civil(end, 'end')
  if (last.epoch < first.epoch) throw new RangeError('end must not precede start')
  if (first.epoch === last.epoch) return 0
  if (convention === 'ACT/360' || convention === 'ACT/365F') {
    return (last.epoch - first.epoch) / DAY_MS
  }

  let a = first.day
  let b = last.day
  if (convention === '30E/360') {
    a = Math.min(a, 30)
    b = Math.min(b, 30)
  } else {
    const useFebruaryRule = convention === '30U/360-EOM'
      || (convention === '30U/360' && options.endOfMonth)
    if (useFebruaryRule && februaryEnd(first)) {
      if (februaryEnd(last)) b = 30
      a = 30
    }
    if (a === 31) a = 30
    if (b === 31 && a === 30) b = 30
  }
  return 360 * (last.year - first.year) + 30 * (last.month - first.month) + b - a
}

export function yearFraction(start, end, convention, options = {}) {
  const definition = rules(convention, options)
  return dayCountDays(start, end, convention, options) / definition.denominator
}
