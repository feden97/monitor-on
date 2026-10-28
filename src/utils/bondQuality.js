import holidays from '../data/holidays.json' with { type: 'json' }
import { DAY_COUNT_CONVENTIONS } from './dayCount.js'
import { getCalendarCoverage } from './businessCalendar.js'

export const FINANCIAL_ENGINE_VERSION = 'fixed-income-2.1.0'
export const CALENDAR_LAST_DATE = [...holidays].sort().at(-1) ?? null
export const MARKET_MAX_AGE_MS = 30 * 60 * 1000

function state(status, label, reasons = []) { return { status, label, reasons } }

export function civilDateKey(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null
}

const positivePayment = flow => flow.amortization_pct + flow.interest_pct > 0
const validFlow = flow => civilDateKey(flow?.date)
  && Number.isFinite(flow?.amortization_pct) && flow.amortization_pct >= 0
  && Number.isFinite(flow?.interest_pct) && flow.interest_pct >= 0
const storedFlows = prospecto => {
  const flows = prospecto?.cashflows ?? prospecto?.cash_flows
  return Array.isArray(flows) ? flows : []
}

/** Structural completeness is not contractual certification. */
export function assessSchedule(prospecto, settlementDate) {
  const settlement = civilDateKey(settlementDate)
  const maturity = civilDateKey(prospecto?.maturity_date)
  const flows = prospecto?.cashflows ?? prospecto?.cash_flows
  if (!settlement) return state('contradictory', 'Fecha inválida', ['La liquidación no es una fecha civil válida.'])
  if (!Array.isArray(flows) || !flows.length) {
    if (maturity && maturity < settlement) return state('matured', 'Vencido según catálogo', ['La fecha declarada es anterior a la liquidación; el contrato no se certifica por este estado.'])
    return state('missing', 'Sin cronograma', ['No hay pagos cargados; no se infiere que el instrumento haya vencido.'])
  }
  if (flows.some(flow => !validFlow(flow))) return state('contradictory', 'Cronograma inválido', ['Hay fechas o importes inválidos.'])
  const payments = flows.filter(positivePayment).toSorted((a, b) => a.date.localeCompare(b.date))
  const dates = payments.map(flow => flow.date)
  if (new Set(dates).size !== dates.length) return state('contradictory', 'Pagos duplicados', ['Hay más de un pago económico en la misma fecha; requiere revisión.'])
  if (!maturity) return state('incomplete', 'Vencimiento desconocido', ['Falta una fecha de vencimiento válida para comprobar el horizonte.'])
  if (payments.some(flow => flow.date > maturity)) return state('contradictory', 'Fechas contradictorias', ['El cronograma contiene pagos posteriores al vencimiento declarado.'])
  if (maturity < settlement) return state('matured', 'Vencido según catálogo', ['La fecha declarada es anterior a la liquidación.'])
  if (!payments.length || dates.at(-1) < maturity) return state('incomplete', 'Cronograma truncado', ['Los pagos económicos cargados no llegan al vencimiento.'])
  const principal = payments.reduce((sum, flow) => sum + flow.amortization_pct, 0)
  if (Math.abs(principal - 100) > 1e-6) {
    return state(principal > 100 ? 'contradictory' : 'incomplete', 'Capital por revisar',
      [`La devolución cargada suma ${principal.toFixed(4)} por VN original 100; falta justificar la base o completar la historia.`])
  }
  const frequency = prospecto?.frequency ?? prospecto?.couponsPerYear
  if (!Number.isFinite(prospecto?.coupon_rate) || prospecto.coupon_rate < 0) {
    return state('incomplete', 'Cupón desconocido', ['Falta una tasa contractual para comprobar la periodicidad del cronograma.'])
  }
  if (prospecto.coupon_rate > 0 && ![1, 2, 4, 12].includes(frequency)) {
    return state('incomplete', 'Frecuencia desconocida', ['Falta una frecuencia admitida para detectar intervalos de pagos incompletos.'])
  }
  if (prospecto.coupon_rate > 0 && payments.some(flow => flow.amortization_pct > 0 && flow.interest_pct === 0)) {
    return state('incomplete', 'Cupón de amortización por revisar', ['Un pago de capital no incluye interés pese al cupón positivo declarado; requiere documento antes de valorar.'])
  }
  if (prospecto?.coupon_rate > 0 && [1, 2, 4, 12].includes(frequency)) {
    const next = payments.find(flow => flow.date >= settlement)
    const elapsed = next ? (Date.parse(`${next.date}T00:00:00Z`) - Date.parse(`${settlement}T00:00:00Z`)) / 86_400_000 : Infinity
    if (elapsed > Math.ceil(366 / frequency) + 7) {
      return state('incomplete', 'Próximo cupón distante', ['El próximo pago supera el intervalo de la frecuencia declarada desde la liquidación; puede faltar un cupón.'])
    }
    const monthsPerPeriod = 12 / frequency
    for (let index = 1; index < payments.length; index++) {
      const prior = payments[index - 1].date.split('-').map(Number)
      const next = payments[index].date.split('-').map(Number)
      const months = (next[0] - prior[0]) * 12 + next[1] - prior[1]
      if (months > monthsPerPeriod || (months === monthsPerPeriod && next[2] - prior[2] > 4)) {
        return state('incomplete', 'Intervalo por revisar', ['Hay un intervalo mayor a la frecuencia declarada; no se inventa el cupón faltante.'])
      }
    }
  }
  return state('complete', 'Estructura completa', ['Capital y horizonte coherentes con el catálogo; no certifica el contrato ni eventos posteriores.'])
}

function contractQuality(prospecto, contract) {
  if (contract?.reviewStatus !== 'reviewed-original') return state('unverified', 'Contrato sin verificar', ['No hay revisión documental asociada a esta versión.'])
  const mismatches = []
  if (civilDateKey(prospecto?.maturity_date) !== contract.maturityDate) mismatches.push('vencimiento')
  if (prospecto?.coupon_rate !== contract.annualCouponRate * 100) mismatches.push('cupón')
  if ((prospecto?.frequency ?? prospecto?.couponsPerYear) !== contract.frequency) mismatches.push('frecuencia')
  if (Array.isArray(contract.cashflows)) {
    const observed = storedFlows(prospecto).filter(validFlow).filter(positivePayment)
    const expected = contract.cashflows.filter(positivePayment)
    const amounts = new Map(expected.map(flow => [flow.date, flow]))
    if (observed.length !== expected.length || observed.some(flow => {
      const original = amounts.get(flow.date)
      return !original || Math.abs(flow.amortization_pct - original.amortization_pct) > 1e-8
        || Math.abs(flow.interest_pct - original.interest_pct) > 1e-8
    })) mismatches.push('pagos')
  }
  return mismatches.length
    ? state('contradictory', 'Difiere del contrato', [`La versión del catálogo difiere en: ${mismatches.join(', ')}.`])
    : state('reviewed-original', 'Emisión original revisada', ['Coincide con los documentos de emisión; eventos posteriores y cotizaciones tienen revisión independiente.'])
}

function marketQuality(quote, asOf) {
  if (!Number.isFinite(quote?.c) || quote.c <= 0) return state('invalid', 'Sin precio válido', ['No hay un precio positivo y finito.'])
  // Only an explicitly supplied market timestamp is relevant. Receipt is not trade time.
  const timestamp = typeof quote.marketTimestamp === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(quote.marketTimestamp)
    ? Date.parse(quote.marketTimestamp) : NaN
  const now = asOf instanceof Date ? asOf.getTime() : typeof asOf === 'string' ? Date.parse(asOf) : NaN
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return state('unknown-time', 'Hora de mercado desconocida', ['La hora de consulta no acredita la hora del último negocio.'])
  if (timestamp > now + 60_000) return state('unknown-time', 'Hora de mercado inconsistente', ['La marca del proveedor es posterior al momento de evaluación.'])
  if (now - timestamp > MARKET_MAX_AGE_MS) return state('stale', 'Cotización desactualizada', ['La marca de mercado supera el umbral operativo de 30 minutos; no representa una valoración actual.'])
  const reasons = []
  if (!['dirty', 'clean'].includes(quote.priceType)) reasons.push('Precio limpio/sucio sin confirmar.')
  if (quote.faceValueBasis !== 'original') reasons.push('Base de nominal original sin confirmar.')
  if (!quote.settlementTerm) reasons.push('Plazo de negociación sin confirmar.')
  return state('current', 'Marca de mercado reciente', reasons)
}

export function assessBondQuality(prospecto, settlementDate, { quote, contract, asOf, fetchError } = {}) {
  const settlement = civilDateKey(settlementDate)
  const schedule = assessSchedule(prospecto, settlementDate)
  const contractual = contractQuality(prospecto, contract)
  const market = marketQuality(quote, asOf)
  if (fetchError) market.reasons.push('La consulta de mercado falló; se conserva el último dato recibido.')
  let calendar = settlement && CALENDAR_LAST_DATE && settlement <= CALENDAR_LAST_DATE
    ? state('covered', 'Liquidación dentro del calendario', ['El calendario cargado no certifica todos los centros financieros ni pagos futuros.'])
    : state('out-of-coverage', 'Calendario sin cobertura', [`Último feriado cargado: ${CALENDAR_LAST_DATE ?? 'desconocido'}. El ajuste hábil es provisional.`])
  if (contract?.paymentConvention) {
    const reference = getCalendarCoverage(['AR-BANK', 'US-NY-FED'])
    calendar = state('partial', 'Referencias de calendario parciales', [
      `Referencias conjuntas disponibles de ${reference.from} a ${reference.to}; no cubren todos los pagos hasta vencimiento.`,
      'La regla contractual de traslado está pendiente y New York Fed no acredita la apertura de todos los bancos comerciales.',
    ])
  }
  const onPaymentDate = storedFlows(prospecto).some(flow => validFlow(flow) && positivePayment(flow) && flow.date === settlement)
  const dayCount = prospecto?.discountDayCount ?? prospecto?.dayConvention
  const knownDayCount = [360, 365].includes(dayCount)
    || DAY_COUNT_CONVENTIONS.some(item => item.id === dayCount && !item.requiresEndOfMonth)
  const canCalculate = schedule.status === 'complete' && contractual.status !== 'contradictory'
    && Number.isFinite(quote?.c) && quote.c > 0 && !onPaymentDate && knownDayCount
    && quote.priceType !== 'clean' && quote.faceValueBasis !== 'residual'
  const reviewedMarketConventions = contract?.subsequentEventsReviewStatus === 'reviewed'
    && contract?.businessDayCalendarReviewStatus === 'reviewed'
    && contract?.yieldConventionReviewStatus === 'reviewed'
    && contract?.species?.some(species => species.ticker === quote?.symbol && species.reviewStatus === 'reviewed')
  const rankingEligible = canCalculate && contractual.status === 'reviewed-original'
    && market.status === 'current' && !market.reasons.length && quote.priceType === 'dirty'
    && calendar.status === 'covered' && reviewedMarketConventions && quote.settlementDate === settlement
  const reasons = []
  if (schedule.status !== 'complete') reasons.push(...schedule.reasons)
  if (contractual.status === 'contradictory') reasons.push(...contractual.reasons)
  if (onPaymentDate) reasons.push('Liquidación en fecha de pago: falta establecer el derecho al cobro.')
  if (!knownDayCount) reasons.push('Falta una convención de días admitida y explícita.')
  if (quote?.priceType === 'clean') reasons.push('El precio está identificado como limpio; falta convertirlo a sucio con devengamiento comprobado.')
  if (quote?.faceValueBasis === 'residual') reasons.push('El precio está expresado por nominal residual; falta normalizarlo a VN original 100 con capital pendiente verificado.')
  if (canCalculate && !reviewedMarketConventions) reasons.push('Falta revisar eventos posteriores, calendario, convención de rendimiento y relación entre especie e instrumento.')
  if (!Number.isFinite(quote?.c) || quote.c <= 0) reasons.push('Falta un precio válido.')
  if (canCalculate && !rankingEligible) reasons.push('Estimación con el cronograma cargado, precio tratado como sucio y fechas teóricas; no habilita un ranking verificado.')
  const calculation = schedule.status === 'matured'
    ? state('matured', 'Sin cálculo: vencido según catálogo', schedule.reasons)
    : state(canCalculate ? rankingEligible ? 'valid' : 'indicative' : 'blocked',
      canCalculate ? rankingEligible ? 'Cálculo documentado' : 'Cálculo indicativo' : 'Cálculo bloqueado', reasons)
  return { contract: contractual, schedule, market, calendar, calculation, canCalculate, rankingEligible }
}
