import { DAY_COUNT_CONVENTIONS, DAY_COUNT_VERSION, yearFraction } from './dayCount.js'
import { effectiveToNominal, riskMeasures, yieldFromPrice } from './fixedIncomeMath.js'
import { FINANCIAL_ENGINE_VERSION, civilDateKey } from './bondQuality.js'
import { getCalendarCoverage, tryAdjustBusinessDay } from './businessCalendar.js'

export const SCENARIO_DAY_COUNTS = DAY_COUNT_CONVENTIONS.filter(item => !item.requiresEndOfMonth)
export const REFERENCE_CALENDARS = ['AR-BANK', 'US-NY-FED']

function shiftedDate(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

function metricsFor(flows, dirtyPrice, frequency) {
  const rate = yieldFromPrice(flows, dirtyPrice, { basis: 'effective-annual' })
  if (rate == null) throw new Error('No se encontró una TIR representable para estas entradas.')
  const risk = riskMeasures(flows, rate, { basis: 'effective-annual' })
  const nominalRate = effectiveToNominal(rate, frequency)
  const nominal = riskMeasures(flows, nominalRate, { basis: 'nominal', frequency })
  return { ytm: rate * 100, tna: nominalRate * 100, duration: risk.macaulayDuration,
    modDuration: nominal.modifiedDuration, effectiveModDuration: risk.modifiedDuration,
    convexity: risk.convexity, nominalConvexity: nominal.convexity }
}

/** Bounded laboratory for the reviewed regular, fixed-rate YPF contract.
 * All amounts use original VN 100. These are explicit theoretical scenarios,
 * never a claim about a current market trade or subsequent issuer events.
 */
export function calculateBondScenario(contract, inputs) {
  if (contract?.instrumentId !== 'ypf-international-xxxiv-2025-01-17'
    || contract.reviewStatus !== 'reviewed-original') throw new Error('Este laboratorio requiere el contrato original revisado de YM34D.')
  const settlement = civilDateKey(inputs?.settlementDate)
  if (!settlement || settlement < contract.issueDate || settlement >= contract.maturityDate) {
    throw new Error('La liquidación debe estar entre la emisión y el día anterior al vencimiento.')
  }
  if (!Number.isFinite(inputs.price) || inputs.price <= 0) throw new Error('Ingresá un precio positivo y finito.')
  if (!['dirty', 'clean'].includes(inputs.priceType)) throw new Error('Indicá si el precio es limpio o sucio.')
  if (!['original', 'residual'].includes(inputs.nominalBasis)) throw new Error('Indicá la base de nominal del precio.')
  if (!SCENARIO_DAY_COUNTS.some(item => item.id === inputs.accrualDayCount && item.id.startsWith('30'))
    || !SCENARIO_DAY_COUNTS.some(item => item.id === inputs.discountDayCount)) {
    throw new Error('Seleccioná convenciones explícitas de devengamiento y descuento.')
  }
  const payments = contract.cashflows.filter(flow => flow.interest_pct + flow.amortization_pct > 0)
    .toSorted((a, b) => a.date.localeCompare(b.date))
  // Regular record date is one calendar day before the contractual coupon.
  // Settlement on either boundary needs market entitlement rules not modeled here.
  if (payments.some(flow => settlement === flow.date || settlement === shiftedDate(flow.date, -1))) {
    throw new Error('Liquidación en fecha de registro o pago: falta determinar el derecho al cupón. Elegí otra fecha para este escenario.')
  }
  const future = payments.filter(flow => flow.date > settlement)
  const prior = payments.filter(flow => flow.date < settlement).at(-1)?.date ?? contract.issueDate
  const outstanding = 100 - payments.filter(flow => flow.date < settlement)
    .reduce((sum, flow) => sum + flow.amortization_pct, 0)
  if (!(outstanding > 0)) throw new Error('El escenario no tiene capital pendiente.')
  const accrued = outstanding * contract.annualCouponRate * yearFraction(prior, settlement, inputs.accrualDayCount)
  const originalPrice = inputs.price * (inputs.nominalBasis === 'residual' ? outstanding / 100 : 1)
  const dirtyPrice = originalPrice + (inputs.priceType === 'clean' ? accrued : 0)
  const cleanPrice = dirtyPrice - accrued
  const cashflows = future.map(flow => {
    const reference = tryAdjustBusinessDay(flow.date, REFERENCE_CALENDARS, 'following')
    return { date: flow.date, adjustedDate: reference.date, referenceCalendarStatus: reference.status,
      yearFraction: yearFraction(settlement, flow.date, inputs.discountDayCount),
      interest: flow.interest_pct, principal: flow.amortization_pct,
      total: flow.interest_pct + flow.amortization_pct }
  })
  const times = cashflows.map(flow => ({ time: flow.yearFraction, amount: flow.total }))
  const outputs = { ...metricsFor(times, dirtyPrice, contract.frequency),
    dirtyPrice, cleanPrice, accrued, outstandingPrincipal: outstanding }
  const comparisons = SCENARIO_DAY_COUNTS.map(convention => ({
    convention: convention.id,
    ...metricsFor(future.map(flow => ({
      time: yearFraction(settlement, flow.date, convention.id), amount: flow.interest_pct + flow.amortization_pct,
    })), dirtyPrice, contract.frequency),
  }))
  const calendar = getCalendarCoverage(REFERENCE_CALENDARS)
  const assumptions = [
    'Escenario teórico con cumplimiento de los pagos originales hasta vencimiento, sin rescate, gastos ni impuestos.',
    'El descuento usa las fechas contractuales sin desplazar; las fechas hábiles son una simulación separada de Following.',
    'La familia documental 30/360 no determina la variante: la convención de devengamiento elegida es un supuesto explícito.',
    'Se supone cumplida la amortización original anterior a la liquidación para convertir nominal residual a original.',
    'El calendario NY Fed es una referencia operativa; no acredita el calendario de todos los bancos comerciales de Nueva York.',
    'Sin cobertura conjunta, la fecha ajustada queda desconocida. La regla contractual de desplazamiento y derechos al cupón requieren revisión adicional.',
  ]
  const snapshot = {
    format: 'monitor-on-calculation/v1', engineVersion: FINANCIAL_ENGINE_VERSION,
    id: null, identifierAlgorithm: null,
    instrumentId: contract.instrumentId, symbol: 'YM34D', contractVersion: contract.version,
    documentaryEvidence: contract.documents.map(doc => ({ id: doc.id, url: doc.url, sha256: doc.sha256 })),
    scenario: 'hold-to-maturity', scenarioKind: 'manual-contractual-unadjusted',
    settlementDate: settlement, dayCount: inputs.discountDayCount, accrualDayCount: inputs.accrualDayCount,
    dayCountVersion: DAY_COUNT_VERSION, yieldBasis: 'effective-annual', nominalFrequency: contract.frequency,
    price: { value: dirtyPrice, currency: contract.currency, type: 'dirty', nominalBasis: 'original',
      source: 'manual-scenario', marketTimestamp: null, receivedAt: null },
    userInputs: { ...inputs }, rawCashflows: payments.map(flow => ({ ...flow })),
    cashflows, outputs, calendarReference: calendar, assumptions,
    quality: { calculation: { status: 'indicative', label: 'Escenario manual', reasons: assumptions } },
  }
  return { outputs, comparisons, cashflows, snapshot, calendar, assumptions }
}
