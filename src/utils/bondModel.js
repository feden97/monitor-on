import { analyzeBond, daysBetween, resolveDayCount } from './bondEngine.js'
import { auditedContracts } from '../data/contracts.js'
import { assessBondQuality, civilDateKey, FINANCIAL_ENGINE_VERSION } from './bondQuality.js'
import { DAY_COUNT_VERSION } from './dayCount.js'
import { applyPaymentDateReview, displayedPaymentDate } from './paymentDateReview.js'

// A compact input identifier, not a cryptographic signature or authenticity proof.
function inputIdentifier(inputs) {
  let hash = 0x811c9dc5
  for (const char of JSON.stringify(inputs)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function timestampString(value) {
  if (value == null) return null
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function createSnapshot(symbol, quote, prospecto, contract, metrics, quality, settlementKey, options) {
  const inputs = {
    symbol, engineVersion: FINANCIAL_ENGINE_VERSION,
    contractVersion: contract?.version ?? null,
    instrumentId: contract?.instrumentId ?? contract?.id ?? null,
    documentaryEvidence: contract?.documents?.map(document => ({
      id: document.id, url: document.url, sha256: document.sha256,
      retrievedDate: document.retrievedDate,
    })) ?? [],
    scenario: 'hold-to-maturity', settlementDate: settlementKey,
    settlementReference: options.settlementReference ?? null,
    dayCount: resolveDayCount(prospecto?.discountDayCount ?? prospecto?.dayConvention),
    accrualDayCount: resolveDayCount(prospecto?.accrualDayCount ?? prospecto?.dayConvention),
    dayCountVersion: DAY_COUNT_VERSION,
    yieldBasis: 'effective-annual',
    nominalFrequency: prospecto?.frequency ?? prospecto?.couponsPerYear ?? null,
    evaluatedAt: timestampString(options.asOf),
    price: {
      value: quote.c ?? null, currency: 'USD',
      nominalBasis: quote.faceValueBasis ?? 'unknown',
      type: quote.priceType === 'dirty' ? 'dirty' : quote.priceType === 'clean' ? 'not-used-clean' : 'dirty-assumed',
      observedPriceType: quote.priceType ?? 'unknown',
      marketTimestamp: timestampString(quote.marketTimestamp),
      receivedAt: timestampString(options.receivedAt ?? quote.receivedAt),
      source: quote.source ?? null,
      settlementTerm: quote.settlementTerm ?? null,
    },
    rawCashflows: prospecto?.cashflows ?? prospecto?.cash_flows ?? [],
    couponRate: prospecto?.coupon_rate ?? null,
    issueDate: prospecto?.emission_date ?? contract?.issueDate ?? null,
    maturityDate: prospecto?.maturity_date ?? null,
  }
  const assumptions = [
    'Escenario contractual hasta vencimiento, sin rescate, incumplimiento, gastos ni impuestos.',
    'Descuento con fechas teóricas; fechas hábiles mostradas con el calendario cargado y cobertura explícita.',
    'Importes por VN original 100; la base de la cotización requiere confirmación independiente.',
  ]
  if (!['dirty', 'clean'].includes(quote.priceType)) assumptions.push('La cotización se trata como precio sucio para esta estimación; el proveedor no lo ha confirmado.')
  if (quote.priceType === 'clean') assumptions.push('Cotización limpia identificada: cálculo bloqueado hasta convertirla con devengamiento comprobado.')
  if (prospecto?.dayConvention === 360) assumptions.push('360 selecciona 30E/360 del modelo; la familia contractual 30/360 por sí sola no certifica esta variante.')
  if (options.settlementReference) assumptions.push(options.settlementReference.note)
  else if (!quote.settlementTerm) assumptions.push('Liquidación aportada por el llamador; plazo de mercado no confirmado.')
  const outputs = metrics ? Object.fromEntries(Object.entries(metrics).filter(([key]) => key !== 'futureFlows')) : null
  return {
    format: 'monitor-on-calculation/v1',
    id: inputIdentifier(inputs), identifierAlgorithm: 'FNV-1a-32; not a digital signature',
    ...inputs, assumptions,
    cashflows: metrics?.futureFlows?.map(flow => ({
      date: flow.rawDate, adjustedDate: displayedPaymentDate(flow),
      paymentDateStatus: flow.paymentDateStatus ?? 'legacy-estimate', yearFraction: flow.t,
      interest: flow.intAmt, principal: flow.amortAmt, total: flow.totalAmt,
    })) ?? [],
    sensitivityBases: { duration: 'Macaulay, years', modDuration: 'nominal-annual',
      effectiveModDuration: 'effective-annual', convexity: 'effective-annual P\u2033/P', nominalConvexity: 'nominal-annual P\u2033/P' },
    outputs, quality,
  }
}

/** Build one shared snapshot for coverage, tables and detail panels. */
export function buildBondMarketModel(bonds, prospectos, settlementDate, today, previousMetrics = new Map(), options = {}) {
  const arsQuotes = new Map()
  for (const bond of bonds) {
    if (bond.symbol?.endsWith('O')) arsQuotes.set(bond.symbol, bond)
  }

  const todayDate = new Date(today)
  todayDate.setHours(0, 0, 0, 0)
  const settlementKey = civilDateKey(settlementDate)
  const metricsCache = new Map()
  const rows = []
  const coverage = {
    missingProspecto: 0,
    missingCashflows: 0,
    missingRating: 0,
    missingTickerArs: 0,
  }

  for (const bond of bonds) {
    if (!bond.symbol?.endsWith('D')) continue

    const prospecto = prospectos[bond.symbol]
    const contract = (options.contracts ?? auditedContracts)[bond.symbol] ?? null
    let quality = assessBondQuality(prospecto, settlementDate, {
      quote: bond, contract, asOf: options.asOf ?? today, fetchError: options.fetchError,
    })
    const tickerArs = prospecto?.ticker_o || `${bond.symbol.slice(0, -1)}O`
    const priceArs = arsQuotes.get(tickerArs)?.c ?? null
    const cached = previousMetrics.get(bond.symbol)
    const canReuse = quality.canCalculate && cached && cached.price === bond.c && cached.prospecto === prospecto
      && cached.settlementKey === settlementKey && cached.contractVersion === contract?.version
    let metrics = canReuse
      ? cached.metrics
      : quality.canCalculate ? applyPaymentDateReview(analyzeBond(bond.c, prospecto, settlementDate), contract) : null
    if (quality.canCalculate && (!metrics || metrics.ytm == null)) {
      metrics = null
      quality = { ...quality, canCalculate: false, rankingEligible: false,
        calculation: { status: 'blocked', label: 'Cálculo sin resultado',
          reasons: ['El motor no produjo una TIR; revisar frontera de pago, entradas y dominio numérico.'] } }
    }
    const calculationSnapshot = createSnapshot(bond.symbol, bond, prospecto, contract, metrics, quality, settlementKey, { ...options, asOf: options.asOf ?? today })

    // Retain only the latest entry for each current ticker, including missing data.
    metricsCache.set(bond.symbol, { price: bond.c, prospecto, settlementKey, contractVersion: contract?.version, metrics })
    if (!prospecto) coverage.missingProspecto += 1
    if (prospecto && !metrics) coverage.missingCashflows += 1
    if (!prospecto?.rating) coverage.missingRating += 1
    if (!priceArs) coverage.missingTickerArs += 1

    const nextFlow = metrics?.futureFlows?.[0] || null
    rows.push({
      symbol: bond.symbol,
      tickerArs,
      quote: bond,
      prospecto,
      contract,
      quality,
      calculationSnapshot,
      metrics,
      name: prospecto?.name || bond.symbol,
      law: prospecto?.law || null,
      couponRate: prospecto?.coupon_rate ?? null,
      frequency: prospecto?.frequency ?? null,
      maturityDate: prospecto?.maturity_date ?? null,
      daysToMaturity: settlementKey && prospecto?.maturity_date
        ? daysBetween(settlementDate, new Date(`${prospecto.maturity_date}T00:00:00`))
        : null,
      nextCouponDate: displayedPaymentDate(nextFlow),
      daysToCoupon: displayedPaymentDate(nextFlow) ? daysBetween(todayDate, nextFlow.bizDate) : null,
      priceUsd: bond.c ?? null,
      priceArs,
      ytm: metrics?.ytm ?? null,
      paridad: metrics?.paridad ?? null,
      currentYield: metrics?.currentYield ?? null,
      residualValue: metrics?.futureFlows?.reduce((sum, flow) => sum + flow.amortAmt, 0) ?? null,
      amortType: prospecto?.amort_type ?? null,
      duration: metrics?.duration ?? null,
      volumeNominales: bond.v ?? null,
      operations: bond.q_op ?? null,
      minInvestment: prospecto?.min_investment ?? null,
      currencyType: prospecto?.currency_type ?? null,
      rating: prospecto?.rating ?? null,
    })
  }

  const totalChecks = rows.length * 4
  const missingChecks = Object.values(coverage).reduce((total, value) => total + value, 0)
  const coverageSummary = rows.length ? {
    ...coverage,
    score: Math.round(((totalChecks - missingChecks) / totalChecks) * 100),
    totalRows: rows.length,
    totalChecks,
    availableChecks: totalChecks - missingChecks,
  } : null

  return { rows, coverage, coverageSummary, metricsCache }
}

/** Missing values always sort last, for text and numbers in both directions. */
export function compareBondValues(valueA, valueB, direction = 'asc') {
  const missingA = valueA == null || (typeof valueA === 'number' && !Number.isFinite(valueA))
  const missingB = valueB == null || (typeof valueB === 'number' && !Number.isFinite(valueB))
  if (missingA || missingB) return Number(missingA) - Number(missingB)
  const comparison = typeof valueA === 'string'
    ? valueA.localeCompare(String(valueB))
    : valueA - valueB
  return direction === 'asc' ? comparison : -comparison
}
