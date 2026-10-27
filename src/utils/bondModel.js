import { analyzeBond, daysBetween, formatLocalDate } from './bondEngine.js'

/** Build one shared snapshot for coverage, tables and detail panels. */
export function buildBondMarketModel(bonds, prospectos, settlementDate, today, previousMetrics = new Map()) {
  const arsQuotes = new Map()
  for (const bond of bonds) {
    if (bond.symbol?.endsWith('O')) arsQuotes.set(bond.symbol, bond)
  }

  const todayDate = new Date(today)
  todayDate.setHours(0, 0, 0, 0)
  const settlementKey = formatLocalDate(settlementDate)
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
    const tickerArs = prospecto?.ticker_o || `${bond.symbol.slice(0, -1)}O`
    const priceArs = arsQuotes.get(tickerArs)?.c ?? null
    const cached = previousMetrics.get(bond.symbol)
    const canReuse = cached && cached.price === bond.c && cached.prospecto === prospecto && cached.settlementKey === settlementKey
    const metrics = canReuse
      ? cached.metrics
      : bond.c > 0 && prospecto ? analyzeBond(bond.c, prospecto, settlementDate) : null

    // Retain only the latest entry for each current ticker, including missing data.
    metricsCache.set(bond.symbol, { price: bond.c, prospecto, settlementKey, metrics })
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
      metrics,
      name: prospecto?.name || bond.symbol,
      law: prospecto?.law || null,
      couponRate: prospecto?.coupon_rate ?? null,
      frequency: prospecto?.frequency ?? null,
      maturityDate: prospecto?.maturity_date ?? null,
      daysToMaturity: prospecto?.maturity_date
        ? daysBetween(settlementDate, new Date(`${prospecto.maturity_date}T00:00:00`))
        : null,
      nextCouponDate: nextFlow?.date ?? null,
      daysToCoupon: nextFlow ? daysBetween(todayDate, nextFlow.bizDate) : null,
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
      minInvestment: prospecto?.min_investment ?? 1,
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
