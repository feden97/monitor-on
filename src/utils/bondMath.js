/**
 * Bond Mathematics Library for Argentine ONs (Obligaciones Negociables).
 *
 * All calculations assume:
 * - Prices are per 100 of face value (VN)
 * - Coupon rates are annual percentages (e.g. 7.75 = 7.75%)
 * - Day count convention defaults to 360 (configurable)
 */

// ── Day Count Helpers ────────────────────────────────────────────────

/**
 * Days between two dates.
 */
export function daysBetween(d1, d2) {
  const ms = new Date(d2) - new Date(d1)
  return Math.round(ms / 86_400_000)
}

/**
 * Days from today to a target date.
 */
export function daysToDate(target) {
  return daysBetween(new Date(), target)
}

// ── Accrued Interest (Cupón Corrido) ─────────────────────────────────

/**
 * Calculate accrued interest since the last coupon date.
 *
 * @param {number} couponRate   - Annual coupon rate (e.g. 7.75)
 * @param {number} couponsPerYear - Number of coupons per year (1, 2, 4)
 * @param {string|Date} lastCouponDate - Date of the last coupon payment
 * @param {number} dayConvention - Day count convention (360 or 365)
 * @returns {number} Accrued interest per 100 VN
 */
export function calcCouponAccrued(flows, settlementDate, dayConvention = 360) {
  if (!flows || flows.length === 0) return 0
  
  // Find the most recent coupon date before settlementDate
  const pastFlows = flows
    .filter(f => new Date(f.date) < settlementDate)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  
  if (pastFlows.length === 0) return 0 // Assuming no accrued if no past flow
  
  const lastCouponDate = new Date(pastFlows[0].date)
  const daysSinceLastCoupon = daysBetween(lastCouponDate, settlementDate)
  
  // Total days in the current coupon period (simplified to 180 for semi-annual or use convention)
  // For now, let's use a simpler logic or find the next coupon date
  const nextFlows = flows
    .filter(f => new Date(f.date) >= settlementDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    
  if (nextFlows.length === 0) return 0
  
  const nextCouponDate = new Date(nextFlows[0].date)
  const totalDaysInPeriod = daysBetween(lastCouponDate, nextCouponDate)
  const couponRate = nextFlows[0].couponPct // This is the period rate
  
  if (totalDaysInPeriod === 0) return 0
  return (couponRate * daysSinceLastCoupon) / totalDaysInPeriod
}

// ── Clean Price ──────────────────────────────────────────────────────

/**
 * Clean Price = Dirty Price - Accrued Interest
 */
export function calcCleanPrice(dirtyPrice, accruedInterest) {
  return dirtyPrice - accruedInterest
}

// ── Technical Value (Valor Técnico) ──────────────────────────────────

/**
 * Technical Value = Residual Value × (1 + Accrued Rate)
 * Simplified: VN × residualPct + accruedInterest × residualPct
 *
 * @param {number} residualPct - Residual value as fraction (e.g. 1.0 = 100%)
 * @param {number} accruedInterest - Accrued interest per 100 VN
 * @returns {number} Technical value per 100 VN
 */
export function calcTechnicalValue(residualPct, accruedInterest) {
  return (residualPct * 100) + accruedInterest
}

// ── Paridad ──────────────────────────────────────────────────────────

/**
 * Paridad = (Dirty Price / Technical Value) × 100
 */
export function calcParidad(dirtyPrice, technicalValue) {
  if (!technicalValue || technicalValue === 0) return null
  return (dirtyPrice / technicalValue) * 100
}

// ── Current Yield ────────────────────────────────────────────────────

/**
 * Current Yield = (Annual Coupon / Clean Price) × 100
 */
export function calcCurrentYield(couponRate, cleanPrice, residualPct = 1) {
  if (!cleanPrice || cleanPrice === 0) return null
  return ((couponRate * residualPct) / cleanPrice) * 100
}

// ── TIR (YTM) via Newton-Raphson ─────────────────────────────────────

/**
 * Calculate Yield to Maturity using Newton-Raphson method.
 *
 * @param {number} price        - Current dirty price
 * @param {Array}  cashFlows    - Array of { days: number, amount: number }
 * @param {number} dayConvention - 360 or 365
 * @param {number} maxIter      - Max iterations
 * @param {number} tolerance    - Convergence tolerance
 * @returns {number|null} YTM as annual percentage, or null if no convergence
 */
export function calcTIR(price, cashFlows, dayConvention = 360, maxIter = 200, tolerance = 1e-8) {
  if (!cashFlows || cashFlows.length === 0 || !price || price <= 0) return null

  let ytm = 0.05 // Initial guess: 5%

  for (let i = 0; i < maxIter; i++) {
    let pv = 0
    let dpv = 0 // derivative

    for (const cf of cashFlows) {
      const t = cf.days / dayConvention
      if (t <= 0) continue
      const disc = Math.pow(1 + ytm, t)
      pv += cf.amount / disc
      dpv -= (t * cf.amount) / Math.pow(1 + ytm, t + 1)
    }

    const diff = pv - price

    if (Math.abs(diff) < tolerance) {
      return ytm * 100 // Convert to percentage
    }

    if (Math.abs(dpv) < 1e-15) break // Avoid division by zero

    ytm = ytm - diff / dpv
  }

  return null // Did not converge
}

// ── Duration (Macaulay) ──────────────────────────────────────────────

/**
 * Macaulay Duration = Σ(t × PV(CF)) / Price
 *
 * @param {number} price     - Current dirty price
 * @param {Array}  cashFlows - Array of { days, amount }
 * @param {number} ytm       - YTM as decimal (e.g. 0.07)
 * @param {number} dayConvention - 360 or 365
 * @returns {number|null} Duration in years
 */
export function calcDuration(price, cashFlows, ytm, dayConvention = 360) {
  if (!cashFlows || cashFlows.length === 0 || !price || price <= 0 || ytm == null) return null

  let weightedSum = 0

  for (const cf of cashFlows) {
    const t = cf.days / dayConvention
    if (t <= 0) continue
    const pv = cf.amount / Math.pow(1 + ytm, t)
    weightedSum += t * pv
  }

  return weightedSum / price
}

// ── Modified Duration ────────────────────────────────────────────────

/**
 * Modified Duration = Macaulay Duration / (1 + YTM)
 */
export function calcModDuration(macaulayDuration, ytm) {
  if (macaulayDuration == null || ytm == null) return null
  return macaulayDuration / (1 + ytm)
}

// ── Convexity ────────────────────────────────────────────────────────

/**
 * Convexity = Σ(t × (t+1) × PV(CF)) / (Price × (1+ytm)²)
 */
export function calcConvexity(price, cashFlows, ytm, dayConvention = 360) {
  if (!cashFlows || cashFlows.length === 0 || !price || price <= 0 || ytm == null) return null

  let sum = 0

  for (const cf of cashFlows) {
    const t = cf.days / dayConvention
    if (t <= 0) continue
    const pv = cf.amount / Math.pow(1 + ytm, t)
    sum += t * (t + 1) * pv
  }

  return sum / (price * Math.pow(1 + ytm, 2))
}

// ── Cash Flow Generation ─────────────────────────────────────────────

/**
 * Generate future cash flows from bond prospectus data.
 *
 * @param {object} prospecto - Bond prospectus data
 * @param {number} prospecto.couponRate     - Annual coupon rate %
 * @param {number} prospecto.couponsPerYear - Coupons per year
 * @param {string} prospecto.maturity       - Maturity date
 * @param {Array}  prospecto.couponDates    - Array of "MM-DD" strings
 * @param {Array}  prospecto.amortSchedule  - Array of { date, pct }
 * @param {number} prospecto.residualValue  - Current residual as fraction
 * @returns {Array} Array of { date, days, couponPct, amortPct, totalPct, amount }
 */
export function generateCashFlows(prospecto) {
  if (!prospecto || !prospecto.couponDates || !prospecto.maturity) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const maturity = new Date(prospecto.maturity)
  const flows = []
  const couponPerPeriod = prospecto.couponRate / prospecto.couponsPerYear

  // Build amort map: date string → pct
  const amortMap = new Map()
  if (prospecto.amortSchedule) {
    for (const a of prospecto.amortSchedule) {
      amortMap.set(a.date, a.pct)
    }
  }

  // Generate all coupon dates from today to maturity
  const currentYear = today.getFullYear()
  const maturityYear = maturity.getFullYear()

  let runningResidual = prospecto.residualValue ?? 1.0

  for (let year = currentYear; year <= maturityYear; year++) {
    for (const md of prospecto.couponDates) {
      const [month, day] = md.split('-').map(Number)
      const couponDate = new Date(year, month - 1, day)

      if (couponDate <= today) continue
      if (couponDate > maturity) continue

      const days = daysBetween(today, couponDate)
      const dateStr = couponDate.toISOString().split('T')[0]

      // Coupon amount based on current residual
      const couponAmt = couponPerPeriod * runningResidual

      // Amortization
      const amortPct = amortMap.get(dateStr) || 0
      const amortAmt = amortPct / 100

      const totalAmount = couponAmt + (amortAmt * 100)

      flows.push({
        date: dateStr,
        days,
        couponPct: couponPerPeriod,
        amortPct,
        totalPct: couponPerPeriod + amortPct,
        amount: totalAmount,
      })

      runningResidual -= amortAmt
      if (runningResidual < 0) runningResidual = 0
    }
  }

  return flows.sort((a, b) => a.days - b.days)
}

// ── Parse BYMA Interest String ───────────────────────────────────────

/**
 * Parse BYMA's "interes" field to extract the coupon rate.
 * Examples: "FIJO 7%", "FIJO 7.750%", "VARIABLE BADLAR+2%"
 *
 * @param {string} interesStr - BYMA interest string
 * @returns {{ type: string, rate: number|null }}
 */
export function parseInterestString(interesStr) {
  if (!interesStr) return { type: 'unknown', rate: null }

  const str = interesStr.toUpperCase().trim()

  if (str.startsWith('FIJO')) {
    const match = str.match(/([\d.]+)/)
    return {
      type: 'fixed',
      rate: match ? parseFloat(match[1]) : null,
    }
  }

  if (str.includes('BADLAR') || str.includes('VARIABLE')) {
    const match = str.match(/\+([\d.]+)/)
    return {
      type: 'variable',
      rate: match ? parseFloat(match[1]) : null,
      base: str.includes('BADLAR') ? 'BADLAR' : 'VARIABLE',
    }
  }

  return { type: 'other', rate: null, raw: interesStr }
}

// ── Parse Amortization String ────────────────────────────────────────

/**
 * Parse BYMA's "formaAmortizacion" field to determine type.
 * Examples: "AL VENCIMIENTO", "EN TRES CUOTAS, DOS DE 33% Y LA ULTIMA DE 34%"
 *
 * @param {string} amortStr
 * @returns {{ type: string, description: string }}
 */
export function parseAmortString(amortStr) {
  if (!amortStr) return { type: 'unknown', description: '—' }

  const str = amortStr.toUpperCase().trim()

  if (str.includes('AL VENCIMIENTO') || str.includes('BULLET')) {
    return { type: 'bullet', description: 'Bullet' }
  }

  return { type: 'amortizing', description: amortStr }
}
