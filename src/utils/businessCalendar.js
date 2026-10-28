import argentinaBank from '../data/calendars/ar-bank-2026.json' with { type: 'json' }
import newYorkFed from '../data/calendars/us-ny-fed-2026-2027.json' with { type: 'json' }

const DAY_MS = 86_400_000
const RULES = new Set(['following', 'modified-following', 'preceding', 'unadjusted'])

function freezeRecursively(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeRecursively)
    Object.freeze(value)
  }
  return value
}

function calendarError(code, message, details = {}) {
  return Object.assign(new RangeError(message), { code, ...details })
}

/** ISO civil dates only: never infer a calendar day from a zoned timestamp. */
export function parseCivilDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw calendarError('INVALID_CIVIL_DATE', 'La fecha debe ser civil ISO (AAAA-MM-DD).')
  }
  const milliseconds = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== date) {
    throw calendarError('INVALID_CIVIL_DATE', `Fecha civil inválida: ${date}.`)
  }
  return milliseconds
}

export function advanceCivilDate(date, days) {
  if (!Number.isSafeInteger(days)) throw calendarError('INVALID_DAY_COUNT', 'Los días deben ser un entero seguro.')
  const milliseconds = parseCivilDate(date) + days * DAY_MS
  if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > 8.64e15) {
    throw calendarError('INVALID_CIVIL_DATE', 'La fecha resultante está fuera del rango admitido.')
  }
  const result = new Date(milliseconds).toISOString().slice(0, 10)
  parseCivilDate(result)
  return result
}

function validateCalendar(calendar) {
  parseCivilDate(calendar.coverage?.from)
  parseCivilDate(calendar.coverage?.to)
  if (calendar.coverage.from > calendar.coverage.to) throw new Error(`Invalid coverage: ${calendar.id}`)
  const dates = new Set()
  const sourceIds = new Set(calendar.sources.map(source => source.id))
  for (const holiday of calendar.holidays) {
    parseCivilDate(holiday.date)
    if (dates.has(holiday.date) || holiday.date < calendar.coverage.from || holiday.date > calendar.coverage.to
      || !holiday.sourceIds?.length || holiday.sourceIds.some(id => !sourceIds.has(id))) {
      throw new Error(`Invalid holiday manifest: ${calendar.id}/${holiday.date}`)
    }
    dates.add(holiday.date)
  }
  return calendar
}

export const CALENDARS = freezeRecursively(Object.fromEntries(
  [argentinaBank, newYorkFed].map(calendar => [calendar.id, validateCalendar(calendar)]),
))
const holidaysByCalendar = new Map(Object.values(CALENDARS).map(calendar =>
  [calendar.id, new Set(calendar.holidays.map(holiday => holiday.date))]))

function selectedCalendars(calendarIds) {
  const ids = typeof calendarIds === 'string' ? [calendarIds] : calendarIds
  if (!Array.isArray(ids) || !ids.length) {
    throw calendarError('UNKNOWN_CALENDAR', 'Debe elegirse al menos un calendario explícito.')
  }
  return [...new Set(ids)].map(id => {
    if (typeof id !== 'string' || !Object.hasOwn(CALENDARS, id)) {
      throw calendarError('UNKNOWN_CALENDAR', `Calendario desconocido: ${String(id)}.`)
    }
    return CALENDARS[id]
  })
}

/** Joint calendar: a day is open only if every chosen center is open. */
export function getCalendarCoverage(calendarIds) {
  const selected = selectedCalendars(calendarIds)
  const from = selected.reduce((latest, calendar) => calendar.coverage.from > latest ? calendar.coverage.from : latest, '0000-01-01')
  const to = selected.reduce((earliest, calendar) => calendar.coverage.to < earliest ? calendar.coverage.to : earliest, '9999-12-31')
  return {
    status: from <= to ? 'covered-range' : 'no-common-range',
    from: from <= to ? from : null,
    to: from <= to ? to : null,
    calendars: selected.map(calendar => ({ id: calendar.id, version: calendar.version,
      coverage: { ...calendar.coverage }, reviewedAt: calendar.reviewedAt, reviewStatus: calendar.reviewStatus,
      sources: calendar.sources.map(source => ({ ...source })) })),
    notes: selected.flatMap(calendar => calendar.notes),
  }
}

function assertCovered(date, selected) {
  for (const calendar of selected) {
    if (date < calendar.coverage.from || date > calendar.coverage.to) {
      throw calendarError('CALENDAR_OUT_OF_COVERAGE',
        `${calendar.id} no cubre ${date}; rango ${calendar.coverage.from} a ${calendar.coverage.to}.`,
        { calendarId: calendar.id, date, coverage: { ...calendar.coverage } })
    }
  }
}

function openOn(date, selected) {
  const milliseconds = parseCivilDate(date)
  assertCovered(date, selected)
  const weekday = new Date(milliseconds).getUTCDay()
  return selected.every(calendar => !calendar.weekendDays.includes(weekday)
    && !holidaysByCalendar.get(calendar.id).has(date))
}

export function isBusinessDay(date, calendarIds) {
  return openOn(date, selectedCalendars(calendarIds))
}

/** Unadjusted still checks coverage: it must not assert an unknown day is open. */
export function adjustBusinessDay(date, calendarIds, rule = 'following') {
  if (!RULES.has(rule)) throw calendarError('UNKNOWN_ADJUSTMENT_RULE', `Regla de ajuste desconocida: ${String(rule)}.`)
  const selected = selectedCalendars(calendarIds)
  const open = openOn(date, selected)
  if (rule === 'unadjusted' || open) return date
  const roll = direction => {
    let result = date
    for (let days = 0; days < 370; days++) {
      result = advanceCivilDate(result, direction)
      if (openOn(result, selected)) return result
    }
    throw calendarError('NO_BUSINESS_DAY', 'No se encontró un día hábil dentro del límite de búsqueda.')
  }
  if (rule === 'preceding') return roll(-1)
  const following = roll(1)
  return rule === 'modified-following' && following.slice(0, 7) !== date.slice(0, 7) ? roll(-1) : following
}

/** Zero leaves the date unadjusted; positive/negative counts exclude start. */
export function addBusinessDays(date, days, calendarIds) {
  if (!Number.isSafeInteger(days)) throw calendarError('INVALID_DAY_COUNT', 'Los días hábiles deben ser un entero seguro.')
  const selected = selectedCalendars(calendarIds)
  openOn(date, selected)
  if (days === 0) return date
  let result = date
  const direction = Math.sign(days)
  let remaining = Math.abs(days)
  // Every step is coverage-checked; the search never invents future calendars.
  while (remaining) {
    result = advanceCivilDate(result, direction)
    if (openOn(result, selected)) remaining--
  }
  return result
}

/** UI-friendly absence of a result; never silently falls back to weekends. */
export function tryAdjustBusinessDay(date, calendarIds, rule = 'following') {
  try {
    const adjusted = adjustBusinessDay(date, calendarIds, rule)
    return { date: adjusted, status: adjusted === date ? 'unchanged' : 'adjusted',
      reason: null, calendarIds: selectedCalendars(calendarIds).map(calendar => calendar.id), rule }
  } catch (error) {
    if (!error?.code) throw error
    return { date: null, status: error.code === 'CALENDAR_OUT_OF_COVERAGE' ? 'out-of-coverage' : 'invalid',
      reason: error.message, calendarIds: Array.isArray(calendarIds) ? [...calendarIds] : [calendarIds], rule,
      errorCode: error.code }
  }
}
