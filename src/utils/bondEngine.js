import holidays from '../data/holidays.json'

// Load holidays into a Set for O(1) lookups
const holidaySet = new Set(holidays)

// ── Day Count & Business Days ───────────────────────────────────────

/**
 * Checks if a Date object is a weekend or Argentine holiday.
 */
export function isHolidayOrWeekend(dateObj) {
  const day = dateObj.getDay()
  if (day === 0 || day === 6) return true // 0=Sun, 6=Sat
  const dateStr = dateObj.toISOString().split('T')[0]
  return holidaySet.has(dateStr)
}

/**
 * Rolls a date forward to the next valid business day.
 * (Following Business Day Convention)
 */
export function getNextBusinessDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00") // Force local timezone at midnight
  if (isNaN(d.getTime())) return null
  
  while (isHolidayOrWeekend(d)) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

/**
 * Days between two Date objects (Actual days, calendar math).
 */
export function daysBetween(d1, d2) {
  const ms = d2.getTime() - d1.getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * Days between two Dates using European 30E/360 method (Excel DIAS360 method 1)
 * Assumes 30 days per month exactly.
 */
export function calcDays360EU(d1, d2) {
  let day1 = d1.getDate()
  let m1 = d1.getMonth() + 1
  let y1 = d1.getFullYear()
  
  let day2 = d2.getDate()
  let m2 = d2.getMonth() + 1
  let y2 = d2.getFullYear()
  
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
  if (!rawCashflows || !Array.isArray(rawCashflows)) return []

  // Ensure settlement is at midnight local
  const sDate = new Date(settlementDate)
  sDate.setHours(0, 0, 0, 0)

  return rawCashflows.map(cf => {
    const rawDateStr = cf.date
    const rawDateObj = new Date(rawDateStr + "T00:00:00")
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
      date: bizDate.toISOString().split('T')[0], // UI date
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

  const sDate = new Date(settlementDate)
  sDate.setHours(0, 0, 0, 0)

  // Use the theoretical raw dates to find the exact accrual boundaries
  const nextDateObj = nextFlows[0].rawDateObj
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
    lastDateObj = new Date(prospecto.emission_date + "T00:00:00")
  } 

  // If no last date is known, we fall back to assuming 0 accrued or we infer it
  if (!lastDateObj) return 0

  // Calculate days passed strictly between theoretical unadjusted dates
  let daysAccrued = convention === 360 
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
  const futureAmort = processedFlows
    .filter(f => f.days >= 0)
    .reduce((sum, f) => sum + f.amortAmt, 0)
    
  return futureAmort + accruedInterest
}

/**
 * YTM (TIR) via Newton-Raphson
 * Annualized Yield to Maturity
 */
export function calcYTM(price, processedFlows, maxIter = 100, tol = 1e-7) {
  const futureFlows = processedFlows.filter(f => f.days > 0 && f.totalAmt > 0)
  if (futureFlows.length === 0 || price <= 0) return null

  let ytm = 0.05 // 5% guess

  for (let i = 0; i < maxIter; i++) {
    let pv = 0
    let dpv = 0
    for (const f of futureFlows) {
      if (f.t <= 0) continue
      const disc = Math.pow(1 + ytm, f.t)
      pv += f.totalAmt / disc
      dpv -= (f.t * f.totalAmt) / Math.pow(1 + ytm, f.t + 1)
    }

    const diff = pv - price
    if (Math.abs(diff) < tol) return ytm
    if (Math.abs(dpv) < 1e-15) break
    ytm = ytm - diff / dpv
  }
  return null
}

/**
 * Macaulay Duration (in years)
 */
export function calcMacaulayDuration(price, processedFlows, ytm) {
  const futureFlows = processedFlows.filter(f => f.days > 0 && f.totalAmt > 0)
  if (futureFlows.length === 0 || price <= 0 || ytm == null) return null

  let weightedSum = 0
  for (const f of futureFlows) {
    const pv = f.totalAmt / Math.pow(1 + ytm, f.t)
    weightedSum += f.t * pv
  }
  return weightedSum / price
}

// ── Main Engine Wrapper ──────────────────────────────────────────────

/**
 * Computes all bond metrics in one pass
 */
export function analyzeBond(dirtyPrice, prospecto, settlementDate = new Date()) {
  const rawCashflows = prospecto?.cashflows || prospecto?.cash_flows || []
  if (!dirtyPrice || !rawCashflows || rawCashflows.length === 0) return null

  // Process timeline passing the convention if it exists (defaults to 365 for YTM math)
  const convention = prospecto?.dayConvention || 365
  const processed = processCashflows(rawCashflows, settlementDate, convention)
  
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
  const oneYearFromNow = new Date(settlementDate)
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
  const annualInterest = processed
    .filter(f => f.days > 0 && f.bizDate <= oneYearFromNow)
    .reduce((sum, f) => sum + f.intAmt, 0)
    
  const currentYield = cleanPrice > 0 ? annualInterest / cleanPrice : null

  const ytmDecimal = calcYTM(dirtyPrice, processed)
  const duration = calcMacaulayDuration(dirtyPrice, processed, ytmDecimal)
  
  // Transform TEA (ytmDecimal) into TNA (APR) to calculate Institutional Modified Duration
  const frequency = prospecto?.frequency || 2
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
