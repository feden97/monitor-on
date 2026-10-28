/**
 * Isolated fixed-income laboratory. No market-data or application dependencies.
 *
 * Inputs: future contractual cashflows { time: years, amount: currency per 100 VN }.
 * Rates are decimals. Prices are DIRTY prices in the same currency and VN basis.
 * The caller must establish settlement, entitlement, day count, completeness,
 * clean/dirty conversion and any business-day adjustment before using this API.
 * This module never infers contractual dates, coupons, calls or missing payments.
 */

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`)
  }
  return value
}

function positive(value, name) {
  finite(value, name)
  if (value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

function frequencyValue(frequency) {
  if (!Number.isSafeInteger(frequency) || frequency <= 0) {
    throw new RangeError('frequency must be a positive safe integer')
  }
  return frequency
}

function convention(options) {
  if (!options || !['effective-annual', 'nominal'].includes(options.basis)) {
    throw new RangeError('Specify basis: effective-annual or nominal')
  }
  if (options.basis === 'effective-annual') {
    if (options.frequency !== undefined && options.frequency !== 1) {
      throw new RangeError('effective-annual basis has frequency 1')
    }
    return 1
  }
  return frequencyValue(options.frequency)
}

function cashflows(flows) {
  if (!Array.isArray(flows) || flows.length === 0) {
    throw new RangeError('At least one future cashflow is required')
  }
  for (const flow of flows) {
    positive(flow?.time, 'cashflow.time')
    positive(flow?.amount, 'cashflow.amount')
  }
  return flows
}

function growth(rate, frequency) {
  finite(rate, 'rate')
  if (rate <= -frequency) throw new RangeError('rate is below the compounding domain')
  return frequency * Math.log1p(rate / frequency)
}

/** Log-sum-exp keeps root finding stable for very negative/positive yields. */
function logPresentValue(flows, annualLogGrowth) {
  const terms = flows.map(flow => Math.log(flow.amount) - flow.time * annualLogGrowth)
  let largest = -Infinity
  for (const term of terms) largest = Math.max(largest, term)
  if (!Number.isFinite(largest)) return { logPrice: largest, duration: NaN }
  let scaledSum = 0
  let scaledTime = 0
  for (let index = 0; index < flows.length; index++) {
    const weight = Math.exp(terms[index] - largest)
    scaledSum += weight
    scaledTime += weight * flows[index].time
  }
  return {
    logPrice: largest + Math.log(scaledSum),
    duration: scaledTime / scaledSum,
    terms,
  }
}

function finitePrice(logPrice) {
  const price = Math.exp(logPrice)
  if (!Number.isFinite(price) || price <= 0) {
    throw new RangeError('Present value is outside the representable numeric range')
  }
  return price
}

/** Convert nominal annual j_m to effective annual yield. */
export function nominalToEffective(rate, frequency) {
  frequencyValue(frequency)
  const effective = Math.expm1(growth(rate, frequency))
  if (!Number.isFinite(effective) || effective <= -1) {
    throw new RangeError('Equivalent effective yield is outside the numeric range')
  }
  return effective
}

/** Convert effective annual yield to nominal annual j_m. */
export function effectiveToNominal(rate, frequency) {
  frequencyValue(frequency)
  const nominal = frequency * Math.expm1(growth(rate, 1) / frequency)
  if (!Number.isFinite(nominal) || nominal <= -frequency) {
    throw new RangeError('Equivalent nominal yield is outside the numeric range')
  }
  return nominal
}

export function priceFromYield(flows, rate, options) {
  const frequency = convention(options)
  cashflows(flows)
  return finitePrice(logPresentValue(flows, growth(rate, frequency)).logPrice)
}

/**
 * Unique IRR for strictly positive future payments and one initial dirty price.
 * Safeguarded Newton/bisection solves annual log growth, rather than stepping
 * outside the fractional-power domain. Returns null on nonconvergence or when
 * the equivalent yield cannot be represented as a JavaScript number.
 */
export function yieldFromPrice(flows, dirtyPrice, options) {
  const frequency = convention(options)
  cashflows(flows)
  positive(dirtyPrice, 'dirtyPrice')
  const maxIterations = options.maxIterations ?? 200
  const relativeTolerance = options.relativeTolerance ?? 1e-12
  if (!Number.isSafeInteger(maxIterations) || maxIterations <= 0) {
    throw new RangeError('maxIterations must be a positive safe integer')
  }
  positive(relativeTolerance, 'relativeTolerance')
  const target = Math.log(dirtyPrice)
  let lower = -1
  let upper = 1
  for (let step = 0; step < 1024 && logPresentValue(flows, lower).logPrice < target; step++) {
    lower *= 2
  }
  for (let step = 0; step < 1024 && logPresentValue(flows, upper).logPrice > target; step++) {
    upper *= 2
  }
  if (!Number.isFinite(lower) || !Number.isFinite(upper)
    || logPresentValue(flows, lower).logPrice < target
    || logPresentValue(flows, upper).logPrice > target) return null

  let current = 0
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const pv = logPresentValue(flows, current)
    const difference = pv.logPrice - target
    if (Math.abs(difference) <= Math.log1p(relativeTolerance)) {
      const result = frequency * Math.expm1(current / frequency)
      // Rounding a tiny growth factor to rate == -frequency is not a valid IRR.
      if (!Number.isFinite(result) || result <= -frequency) return null
      const reconstructedGrowth = growth(result, frequency)
      const repricingError = logPresentValue(flows, reconstructedGrowth).logPrice - target
      return Math.abs(repricingError) <= Math.log1p(relativeTolerance) * 4 ? result : null
    }
    if (difference > 0) lower = current
    else upper = current
    const newton = current + difference / pv.duration
    const midpoint = lower / 2 + upper / 2
    current = Number.isFinite(newton) && newton > lower && newton < upper
      ? newton : midpoint
  }
  return null
}

/**
 * Derivatives refer to the supplied annual yield coordinate (TEA or j_m).
 * convexity = P'' / P. For scenario dP/P use -modifiedDuration*dy
 * + convexityTaylorCoefficient*dy^2. Dumrauf eq.4.10 calls P''/(2P)
 * "convexity"; both quantities are returned to make the convention explicit.
 */
export function riskMeasures(flows, rate, options) {
  const frequency = convention(options)
  cashflows(flows)
  const pv = logPresentValue(flows, growth(rate, frequency))
  const price = finitePrice(pv.logPrice)
  const discountBase = 1 + rate / frequency
  let convexity = 0
  for (let index = 0; index < flows.length; index++) {
    const time = flows[index].time
    const weight = Math.exp(pv.terms[index] - pv.logPrice)
    convexity += weight * time * (time + 1 / frequency) / discountBase ** 2
  }
  const modifiedDuration = pv.duration / discountBase
  if (!Number.isFinite(convexity) || !Number.isFinite(modifiedDuration)) {
    throw new RangeError('Risk measures are outside the representable numeric range')
  }
  return {
    price,
    macaulayDuration: pv.duration,
    modifiedDuration,
    convexity,
    convexityTaylorCoefficient: convexity / 2,
    yieldBasis: options.basis,
    frequency,
  }
}
