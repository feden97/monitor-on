import holidays from '../data/holidays.json' with { type: 'json' }
import { assessSchedule } from './bondQuality.js'
import { effectiveToNominal, riskMeasures, yieldFromPrice } from './fixedIncomeMath.js'
import { dayCountDays, DAY_COUNT_CONVENTIONS, yearFraction } from './dayCount.js'

// Load holidays into a Set for O(1) lookups
const holidaySet = new Set(holidays)

/** A civil date must keep the same calendar day in every browser timezone. */
export function formatLocalDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(0)
    date.setFullYear(year, month - 1, day)
    date.setHours(0, 0, 0, 0)
    return formatLocalDate(date) === value ? date : null
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

/** T+1 calendar day, rolled forward using the existing holiday calendar. */
export function getSettlementDate(now = new Date()) {
  const tomorrow = parseLocalDate(now)
  if (!tomorrow) return null
  tomorrow.setDate(tomorrow.getDate() + 1)
  return getNextBusinessDay(formatLocalDate(tomorrow))
}

// ── Day Count & Business Days ───────────────────────────────────────

/**
 * Checks if a Date object is a weekend or Argentine holiday.
 */
export function isHolidayOrWeekend(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return false
  const day = dateObj.getDay()
  if (day === 0 || day === 6) return true // 0=Sun, 6=Sat
  const dateStr = formatLocalDate(dateObj)
  return holidaySet.has(dateStr)
}

/**
 * Rolls a date forward to the next valid business day.
 * (Following Business Day Convention)
 */
export function getNextBusinessDay(dateStr) {
  const d = parseLocalDate(dateStr)
  if (!d) return null

  while (isHolidayOrWeekend(d)) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

/**
 * Days between two Date objects (Actual days, calendar math).
 */
export function daysBetween(d1, d2) {
  // Compare calendar dates so daylight-saving transitions cannot add/drop days.
  const ms = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate())
    - Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())
  return Math.round(ms / 86_400_000)
}

/**
 * Days between two Dates using European 30E/360 method (Excel DIAS360 method 1)
 * Assumes 30 days per month exactly.
 */
export function calcDays360EU(d1, d2) {
  const first = formatLocalDate(d1)
  const second = formatLocalDate(d2)
  return first <= second ? dayCountDays(first, second, '30E/360') : -dayCountDays(second, first, '30E/360')
}

/** Numeric catalog values retain their prior meaning as explicit assumptions. */
export function resolveDayCount(value) {
  const id = value === 360 ? '30E/360' : value === 365 ? 'ACT/365F' : value
  return DAY_COUNT_CONVENTIONS.some(item => item.id === id && !item.requiresEndOfMonth) ? id : null
}

// ── Cashflow Processing ─────────────────────────────────────────────

/**
 * Transforms raw static cashflows from bondProspectos.json into a
 * dynamic, mathematically usable schedule based on a specific settlement date.
 * 
 * @param {Array} rawCashflows - Array of { date, amortization_pct, interest_pct }
 * @param {Date} settlementDate - Date from which to calculate (usually today)
 * @param {number} dayConvention - 360 or 365
 */
export function processCashflows(rawCashflows, settlementDate = new Date(), dayConvention = 360) {
  const convention = resolveDayCount(dayConvention)
  if (!Array.isArray(rawCashflows) || !convention) return []

  // Ensure settlement is at midnight local
  const sDate = parseLocalDate(settlementDate)
  if (!sDate) return []

  // A partial schedule would silently underprice the bond. Reject the entire
  // schedule if any record is malformed, rather than dropping individual flows.
  const datedFlows = rawCashflows.map(cf => ({ cf, rawDateObj: parseLocalDate(cf?.date) }))
  if (datedFlows.some(({ cf, rawDateObj }) => !rawDateObj
    || !Number.isFinite(cf?.amortization_pct) || cf.amortization_pct < 0
    || !Number.isFinite(cf?.interest_pct) || cf.interest_pct < 0)) return []

  return datedFlows.map(({ cf, rawDateObj }) => {
    const rawDateStr = formatLocalDate(rawDateObj)
    const bizDate = getNextBusinessDay(rawDateStr)

    // Elapsed days against business date (for UI + Payment scheduling)
    const daysFromSettlementBiz = daysBetween(sDate, bizDate)

    // Elapsed days against theoretical raw date (for purely financial accrual/YTM math)
    const settlementKey = formatLocalDate(sDate)
    const before = rawDateStr < settlementKey
    const first = before ? rawDateStr : settlementKey
    const second = before ? settlementKey : rawDateStr
    // Historical signs are for sorting/filtering only. Future discount times
    // always use the convention in the correct chronological direction.
    const daysFromSettlementRaw = dayCountDays(first, second, convention) * (before ? -1 : 1)
    const t = yearFraction(first, second, convention) * (before ? -1 : 1)

    return {
      rawDate: rawDateStr,
      rawDateObj,
      date: formatLocalDate(bizDate), // UI date
      bizDate,
      days: daysFromSettlementBiz, // used for filtering "future" flows in UI
      rawDays: daysFromSettlementRaw, // used for financial math
      t,
      amortAmt: cf.amortization_pct,
      intAmt: cf.interest_pct,
      totalAmt: cf.amortization_pct + cf.interest_pct
    }
  }).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
}

// ── Financial Metrics ───────────────────────────────────────────────

/**
 * Calculates Accrued Interest (Cupón Corrido) exactly to the settlement date.
 * Based on the prior coupon and the next coupon.
 */
export function calcAccruedInterest(processedFlows, prospecto, settlementDate) {
  const sDate = parseLocalDate(settlementDate)
  if (!sDate) return null
  const settlementKey = formatLocalDate(sDate)
  const nextFlows = processedFlows.filter(f => f.rawDate >= settlementKey && f.totalAmt > 0)
  if (nextFlows.length === 0) return null

  // Use the theoretical raw dates to find the exact accrual boundaries
  const pastFlows = processedFlows.filter(f => f.rawDate < settlementKey && f.totalAmt > 0)

  // Get Annual Rate and Convention from Prospecto
  const annualRate = prospecto?.coupon_rate
  const convention = resolveDayCount(prospecto?.accrualDayCount ?? prospecto?.dayConvention)
  if (!Number.isFinite(annualRate) || annualRate < 0 || !convention) return null

  // Calculate Current Residual Value before this upcoming payment
  const residualValuePct = nextFlows.reduce((sum, f) => sum + f.amortAmt, 0) / 100

  // Find when the previous period ended
  let lastDateObj = null
  if (pastFlows.length > 0) {
    lastDateObj = pastFlows[pastFlows.length - 1].rawDateObj
  } else if (prospecto?.emission_date) {
    lastDateObj = parseLocalDate(prospecto.emission_date)
  }

  // Missing accrual boundaries are unknown, never a fabricated zero.
  if (!lastDateObj) return annualRate === 0 ? 0 : null

  // Calculate days passed strictly between theoretical unadjusted dates
  if (lastDateObj > sDate) return null
  const fractionAccrued = yearFraction(formatLocalDate(lastDateObj), formatLocalDate(sDate), convention)

  // Formula B: (Tasa Anual% / Convención) * DiasTranscurridos * ValorResidual
  // Como 'annualRate' está en formato entero (ej. 7, no 0.07), ya representa $ por cada 100 nominales.
  // Valor residual va de 0 a 1.
  const accrued = annualRate * fractionAccrued * residualValuePct

  return accrued > 0 ? accrued : 0
}

/**
 * Calculate Technical Value (Valor Técnico)
 * Sum of all FUTURE amortization + accrued interest
 */
export function calcTechnicalValue(processedFlows, accruedInterest) {
  if (!Number.isFinite(accruedInterest)) return null
  const futureAmort = processedFlows.reduce((sum, f) => sum + (f.days >= 0 ? f.amortAmt : 0), 0)

  return futureAmort + accruedInterest
}

/**
 * YTM (TIR) via Newton-Raphson with a bracketed fallback.
 * Annualized Yield to Maturity
 */
export function calcYTM(price, processedFlows, maxIter = 200, tol = 1e-10) {
  if (!Number.isFinite(price) || price <= 0 || !Array.isArray(processedFlows)
    || !Number.isSafeInteger(maxIter) || maxIter <= 0 || !Number.isFinite(tol) || tol <= 0) return null
  const future = processedFlows.filter(f => f.days > 0 && Number.isFinite(f.totalAmt)
    && f.totalAmt > 0 && Number.isFinite(f.t) && f.t > 0)
    .map(f => ({ time: f.t, amount: f.totalAmt }))
  if (!future.length) return null
  try {
    return yieldFromPrice(future, price, {
      basis: 'effective-annual', maxIterations: maxIter, relativeTolerance: tol / price,
    })
  } catch { return null }
}

/** Macaulay duration; canonical math shared with the independent laboratory. */
export function calcMacaulayDuration(price, processedFlows, ytm) {
  if (!Array.isArray(processedFlows) || !Number.isFinite(price) || price <= 0
    || !Number.isFinite(ytm) || ytm <= -1) return null
  const future = processedFlows.filter(f => f.days > 0 && f.totalAmt > 0 && f.t > 0)
    .map(f => ({ time: f.t, amount: f.totalAmt }))
  if (!future.length) return null
  try {
    const risk = riskMeasures(future, ytm, { basis: 'effective-annual' })
    return risk.macaulayDuration * risk.price / price
  } catch { return null }
}

// ── Main Engine Wrapper ──────────────────────────────────────────────

/**
 * Computes all bond metrics in one pass
 */
export function analyzeBond(dirtyPrice, prospecto, settlementDate = new Date()) {
  if (!Number.isFinite(dirtyPrice) || dirtyPrice <= 0) return null
  const schedule = assessSchedule(prospecto, settlementDate)
  if (schedule.status === 'matured') return { isMatured: true }
  if (schedule.status !== 'complete') return null
  const rawCashflows = prospecto?.cashflows ?? prospecto?.cash_flows
  // 360 retains the legacy 30E/360 assumption, now exposed in every snapshot.
  // Unknown day count does not silently become ACT/365.
  const convention = resolveDayCount(prospecto?.discountDayCount ?? prospecto?.dayConvention)
  if (!convention) return null
  const processed = processCashflows(rawCashflows, settlementDate, convention)
  if (!processed.length) return null
  const futureFlows = processed.filter(f => f.days >= 0 && f.totalAmt > 0)
  // Entitlement on payment date and rolled-over unsettled payments need explicit
  // contract rules. Do not omit a t<=0 economic payment and still quote a yield.
  if (!futureFlows.length || futureFlows.some(f => f.t <= 0)) return null

  const accrued = calcAccruedInterest(processed, prospecto, settlementDate)
  const cleanPrice = accrued == null ? null : dirtyPrice - accrued
  const techValue = calcTechnicalValue(processed, accrued)
  const paridad = techValue > 0 ? dirtyPrice / techValue : null
  const oneYearFromNow = parseLocalDate(settlementDate)
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
  const annualInterest = processed.filter(f => f.days > 0 && f.bizDate <= oneYearFromNow)
    .reduce((sum, f) => sum + f.intAmt, 0)
  const currentYield = cleanPrice > 0 ? annualInterest / cleanPrice : null
  const ytmDecimal = calcYTM(dirtyPrice, processed)
  const explicitFlows = futureFlows.map(f => ({ time: f.t, amount: f.totalAmt }))
  const frequency = prospecto?.frequency ?? prospecto?.couponsPerYear
  let tnaDecimal = null
  let risk = null
  let nominalRisk = null
  if (ytmDecimal != null) {
    try {
      risk = riskMeasures(explicitFlows, ytmDecimal, { basis: 'effective-annual' })
      if (Number.isSafeInteger(frequency) && frequency > 0) {
        tnaDecimal = effectiveToNominal(ytmDecimal, frequency)
        nominalRisk = riskMeasures(explicitFlows, tnaDecimal, { basis: 'nominal', frequency })
      }
    } catch { /* Numeric domain failures remain absent, never NaN. */ }
  }
  return {
    isMatured: false, dirtyPrice, cleanPrice, accrued, techValue,
    paridad: paridad == null ? null : paridad * 100,
    ytm: ytmDecimal == null ? null : ytmDecimal * 100,
    tna: tnaDecimal == null ? null : tnaDecimal * 100,
    currentYield: currentYield == null ? null : currentYield * 100,
    duration: risk?.macaulayDuration ?? null,
    modDuration: nominalRisk?.modifiedDuration ?? null,
    effectiveModDuration: risk?.modifiedDuration ?? null,
    convexity: risk?.convexity ?? null,
    nominalConvexity: nominalRisk?.convexity ?? null,
    futureFlows,
  }
}
