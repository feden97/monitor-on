import { addBusinessDays, getCalendarCoverage } from './businessCalendar.js'

/** A dated reference, not the settlement term of any particular quote. */
export function estimateSettlementDate(tradeDate, calendarIds = ['AR-BANK']) {
  const calendar = getCalendarCoverage(calendarIds)
  try {
    return { date: addBusinessDays(tradeDate, 1, calendarIds), status: 'reference',
      tradeDate, lag: 1, lagBasis: 'business-days', calendar,
      note: 'T+1 hábil de referencia; el plazo y calendario operativo de la cotización no están confirmados.' }
  } catch (error) {
    if (error.code !== 'CALENDAR_OUT_OF_COVERAGE') throw error
    return { date: null, status: 'out-of-coverage', tradeDate, lag: 1, lagBasis: 'business-days', calendar,
      note: 'No se estima liquidación fuera de la cobertura del calendario elegido.' }
  }
}
