import holidays from '../data/holidays.json' with { type: 'json' }

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
  let day1 = d1.getDate()
  const m1 = d1.getMonth() + 1
  const y1 = d1.getFullYear()

  let day2 = d2.getDate()
  const m2 = d2.getMonth() + 1
  const y2 = d2.getFullYear()

  // European rule: If 31st, change to 30th
  if (day1 === 31) day1 = 30
  if (day2 === 31) day2 = 30

  return (y2 - y1) * 360 + (m2 - m1) * 30 + (day2 - day1)
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
  if (!Array.isArray(rawCashflows) || !Number.isFinite(dayConvention) || dayConvention <= 0) return []

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
    const rawDateStr = cf.date
    const bizDate = getNextBusinessDay(rawDateStr)

    // Elapsed days against business date (for UI + Payment scheduling)
    const daysFromSettlementBiz = daysBetween(sDate, bizDate)

    // Elapsed days against theoretical raw date (for purely financial accrual/YTM math)
    const daysFromSettlementRaw = dayConvention === 360
      ? calcDays360EU(sDate, rawDateObj)
      : daysBetween(sDate, rawDateObj)

    return {
      rawDate: rawDateStr,
      rawDateObj,
      date: formatLocalDate(bizDate), // UI date
      bizDate,
      days: daysFromSettlementBiz, // used for filtering "future" flows in UI
      rawDays: daysFromSettlementRaw, // used for financial math
      t: daysFromSettlementRaw / dayConvention,
      amortAmt: cf.amortization_pct,
      intAmt: cf.interest_pct,
      totalAmt: cf.amortization_pct + cf.interest_pct
    }
  }).sort((a, b) => a.rawDays - b.rawDays)
}

// ── Financial Metrics ───────────────────────────────────────────────

/**
 * Calculates Accrued Interest (Cupón Corrido) exactly to the settlement date.
 * Based on the prior coupon and the next coupon.
 */
export function calcAccruedInterest(processedFlows, prospecto, settlementDate) {
  const nextFlows = processedFlows.filter(f => f.rawDays >= 0 && f.totalAmt > 0)
  if (nextFlows.length === 0) return 0

  const sDate = parseLocalDate(settlementDate)
  if (!sDate) return 0

  // Use the theoretical raw dates to find the exact accrual boundaries
  const pastFlows = processedFlows.filter(f => f.rawDays < 0 && f.totalAmt > 0)

  // Get Annual Rate and Convention from Prospecto
  const annualRate = prospecto?.coupon_rate || 0
  const convention = prospecto?.dayConvention || 365

  // Calculate Current Residual Value before this upcoming payment
  const residualValuePct = nextFlows.reduce((sum, f) => sum + f.amortAmt, 0) / 100

  // Find when the previous period ended
  let lastDateObj = null
  if (pastFlows.length > 0) {
    lastDateObj = pastFlows[pastFlows.length - 1].rawDateObj
  } else if (prospecto?.emission_date) {
    lastDateObj = parseLocalDate(prospecto.emission_date)
  }

  // If no last date is known, we fall back to assuming 0 accrued or we infer it
  if (!lastDateObj) return 0

  // Calculate days passed strictly between theoretical unadjusted dates
  const daysAccrued = convention === 360
    ? calcDays360EU(lastDateObj, sDate)
    : daysBetween(lastDateObj, sDate)

  // Formula B: (Tasa Anual% / Convención) * DiasTranscurridos * ValorResidual
  // Como 'annualRate' está en formato entero (ej. 7, no 0.07), ya representa $ por cada 100 nominales.
  // Valor residual va de 0 a 1.
  const accrued = (annualRate / convention) * daysAccrued * residualValuePct

  return accrued > 0 ? accrued : 0
}

/**
 * Calculate Technical Value (Valor Técnico)
 * Sum of all FUTURE amortization + accrued interest
 */
export function calcTechnicalValue(processedFlows, accruedInterest) {
  const futureAmort = processedFlows.reduce((sum, f) => sum + (f.days >= 0 ? f.amortAmt : 0), 0)

  return futureAmort + accruedInterest
}

/**
 * YTM (TIR) via Newton-Raphson with a bracketed fallback.
 * Annualized Yield to Maturity
 */
export function calcYTM(price, processedFlows, maxIter = 100, tol = 1e-7) {
  if (!Number.isFinite(price) || price <= 0 || !Array.isArray(processedFlows)
    || !Number.isFinite(maxIter) || maxIter <= 0 || !Number.isFinite(tol) || tol <= 0) return null
  const futureFlows = processedFlows.filter(f => f.days > 0
    && Number.isFinite(f.totalAmt) && f.totalAmt > 0 && Number.isFinite(f.t) && f.t > 0)
  if (futureFlows.length === 0) return null

  // Positive future payments have a monotonic PV curve for yields above -100%.
  // Keep Newton steps inside this interval so fractional powers stay real.
  const presentValue = yieldRate => futureFlows.reduce(
    (sum, f) => sum + f.totalAmt / Math.pow(1 + yieldRate, f.t), 0)
  let lower = -1 + Number.EPSILON
  let upper = 1
  if (presentValue(lower) < price) return null
  while (presentValue(upper) > price && upper < Number.MAX_VALUE / 2) {
    upper = upper * 2 + 1
  }
  if (presentValue(upper) > price) return null
  let ytm = 0.05 // 5% guess

  for (let i = 0; i < maxIter; i++) {
    let pv = 0
    let dpv = 0
    for (const f of futureFlows) {
      const disc = Math.pow(1 + ytm, f.t)
      pv += f.totalAmt / disc
      dpv -= (f.t * f.totalAmt) / (disc * (1 + ytm))
    }

    const diff = pv - price
    if (Math.abs(diff) < tol) return ytm
    if (diff > 0) lower = ytm
    else upper = ytm
    const next = ytm - diff / dpv
    ytm = Number.isFinite(next) && next > lower && next < upper
      ? next
      : lower + (upper - lower) / 2
  }
  return null
}

/**
 * Macaulay Duration (in years)
 */
export function calcMacaulayDuration(price, processedFlows, ytm) {
  const futureFlows = processedFlows.filter(f => f.days > 0 && f.totalAmt > 0 && f.t > 0)
  if (futureFlows.length === 0 || !Number.isFinite(price) || price <= 0
    || !Number.isFinite(ytm) || ytm <= -1) return null

  let weightedSum = 0
  for (const f of futureFlows) {
    const pv = f.totalAmt / Math.pow(1 + ytm, f.t)
    weightedSum += f.t * pv
  }
  const duration = weightedSum / price
  return Number.isFinite(duration) ? duration : null
}

// ── Main Engine Wrapper ──────────────────────────────────────────────

/**
 * Computes all bond metrics in one pass
 */
export function analyzeBond(dirtyPrice, prospecto, settlementDate = new Date()) {
  const rawCashflows = prospecto?.cashflows || prospecto?.cash_flows || []
  if (!Number.isFinite(dirtyPrice) || dirtyPrice <= 0
    || !Array.isArray(rawCashflows) || rawCashflows.length === 0) return null

  // Process timeline passing the convention if it exists (defaults to 365 for YTM math)
  const convention = prospecto?.dayConvention || 365
  const processed = processCashflows(rawCashflows, settlementDate, convention)
  if (processed.length === 0) return null

  // Future flows (unpaid) to show in the UI (filtered by business days)
  const futureFlows = processed.filter(f => f.days >= 0 && f.totalAmt > 0)

  if (futureFlows.length === 0) return { isMatured: true }

  // 1. Accrued Interest using strict Formula B logic
  const accrued = calcAccruedInterest(processed, prospecto, settlementDate)
  const cleanPrice = dirtyPrice - accrued

  const techValue = calcTechnicalValue(processed, accrued)
  const paridad = techValue > 0 ? (dirtyPrice / techValue) : null

  // Current Yield: Next 365 Days of coupons / Clean Price
  // Or simpler: annual coupon rate (sum of interest over 1 year) / clean
  const oneYearFromNow = parseLocalDate(settlementDate)
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
  const annualInterest = processed
    .filter(f => f.days > 0 && f.bizDate <= oneYearFromNow)
    .reduce((sum, f) => sum + f.intAmt, 0)

  const currentYield = cleanPrice > 0 ? annualInterest / cleanPrice : null

  const ytmDecimal = calcYTM(dirtyPrice, processed)
  const duration = calcMacaulayDuration(dirtyPrice, processed, ytmDecimal)

  // Transform TEA (ytmDecimal) into TNA (APR) to calculate Institutional Modified Duration
  const frequency = Number.isFinite(prospecto?.frequency) && prospecto.frequency > 0
    ? prospecto.frequency : 2
  let tnaDecimal = null
  let modDuration = null

  if (ytmDecimal != null) {
    tnaDecimal = (Math.pow(1 + ytmDecimal, 1 / frequency) - 1) * frequency
    if (duration != null) {
      modDuration = duration / (1 + (tnaDecimal / frequency))
    }
  }

  return {
    isMatured: false,
    dirtyPrice,
    cleanPrice,
    accrued,
    techValue,
    paridad: paridad != null ? paridad * 100 : null,
    ytm: ytmDecimal != null ? ytmDecimal * 100 : null,
    tna: tnaDecimal != null ? tnaDecimal * 100 : null, // The institutional APR yield
    currentYield: currentYield != null ? currentYield * 100 : null,
    duration,
    modDuration,
    futureFlows
  }
}
