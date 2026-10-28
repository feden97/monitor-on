import test from 'node:test'
import assert from 'node:assert/strict'
import {
  effectiveToNominal, nominalToEffective, priceFromYield,
  riskMeasures, yieldFromPrice,
} from './math.mjs'

const effective = { basis: 'effective-annual' }
const semiannual = { basis: 'nominal', frequency: 2 }
const bullet = Array.from({ length: 5 }, (_, index) => ({
  time: index + 1, amount: index === 4 ? 110 : 10,
}))
const near = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Number.isFinite(actual), `Expected finite result, received ${actual}`)
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by ${actual - expected}`)
}

test('Dumrauf PDF59 printed44: five annual 10% coupons, 11% yield, bullet principal', () => {
  const price = priceFromYield(bullet, 0.11, effective)
  near(price, 96.30410298235068)
  assert.equal(price.toFixed(2), '96.30')
  near(yieldFromPrice(bullet, price, effective), 0.11)
  // Apparent displayed-formula erratum: paying 110 in year 4 too is incompatible
  // with both the bullet description and the stated price. Do not encode it.
  const literalPrintedFormula = bullet.map(flow => ({
    ...flow, amount: flow.time === 4 ? 110 : flow.amount,
  }))
  assert.ok(priceFromYield(literalPrintedFormula, 0.11, effective) > 160)
})

test('Dumrauf PDF89/91 printed75/77: par at 10%, Macaulay4.17 and modified3.79', () => {
  const result = riskMeasures(bullet, 0.10, effective)
  near(result.price, 100)
  assert.equal(result.macaulayDuration.toFixed(2), '4.17')
  assert.equal(result.modifiedDuration.toFixed(2), '3.79')
  near(result.modifiedDuration, result.macaulayDuration / 1.10)
  near(result.convexityTaylorCoefficient, result.convexity / 2)
  assert.equal(result.yieldBasis, 'effective-annual')
})

test('zero-coupon price, yield, duration and convexity match analytic expressions', () => {
  const flows = [{ time: 2.75, amount: 100 }]
  for (const [options, frequency, yieldRate] of [
    [effective, 1, 0.09], [semiannual, 2, 0.09], [effective, 1, -0.40],
  ]) {
    const base = 1 + yieldRate / frequency
    const result = riskMeasures(flows, yieldRate, options)
    near(result.price, 100 / base ** (frequency * 2.75))
    near(yieldFromPrice(flows, result.price, options), yieldRate)
    near(result.macaulayDuration, 2.75)
    near(result.modifiedDuration, 2.75 / base)
    near(result.convexity, 2.75 * (2.75 + 1 / frequency) / base ** 2)
  }
})

test('TEA/nominal conversion preserves value but not the yield sensitivity coordinate', () => {
  const tea = 0.0924
  const nominal = effectiveToNominal(tea, 2)
  near(nominalToEffective(nominal, 2), tea)
  assert.equal((nominal * 100).toFixed(2), '9.04')
  const a = riskMeasures(bullet, tea, effective)
  const b = riskMeasures(bullet, nominal, semiannual)
  near(a.price, b.price)
  near(a.macaulayDuration, b.macaulayDuration)
  assert.notEqual(a.modifiedDuration, b.modifiedDuration)
  near(a.modifiedDuration * (1 + tea), a.macaulayDuration)
  near(b.modifiedDuration * (1 + nominal / 2), b.macaulayDuration)
})

test('conversion roundtrips include zero, negative and high yields', () => {
  for (const frequency of [1, 2, 4, 12]) {
    for (const rate of [-0.8, -0.02, 0, 0.07, 3]) {
      near(nominalToEffective(effectiveToNominal(rate, frequency), frequency), rate)
    }
  }
})

test('IRR roundtrips for irregular amortizing payments and both quoted yield bases', () => {
  const flows = [{ time: 0.2, amount: 3 }, { time: 1.1, amount: 32 },
    { time: 1.6, amount: 2 }, { time: 2.7, amount: 72 }]
  for (const options of [effective, semiannual, { basis: 'nominal', frequency: 4 }]) {
    for (const rate of [-0.90, -0.03, 0, 0.12, 1, 20]) {
      const price = priceFromYield(flows, rate, options)
      near(yieldFromPrice(flows, price, options), rate, 1e-8)
    }
  }
})

test('analytic duration and convexity agree with independent finite differences', () => {
  const flows = [{ time: 0.25, amount: 4 }, { time: 0.75, amount: 34 },
    { time: 1.25, amount: 2.8 }, { time: 3.1, amount: 72.8 }]
  const step = 1e-4
  for (const options of [effective, semiannual]) {
    const rate = 0.0825
    const risk = riskMeasures(flows, rate, options)
    const up = priceFromYield(flows, rate + step, options)
    const down = priceFromYield(flows, rate - step, options)
    near(-(up - down) / (2 * step * risk.price), risk.modifiedDuration, 2e-7)
    near((up - 2 * risk.price + down) / (step ** 2 * risk.price), risk.convexity, 2e-6)
  }
})

test('positive payments have decreasing price and positive sensitivity', () => {
  const low = riskMeasures(bullet, 0.05, effective)
  const high = riskMeasures(bullet, 0.15, effective)
  assert.ok(low.price > high.price)
  assert.ok(low.modifiedDuration > 0 && low.convexity > 0)
})

test('VN scaling changes price proportionately and leaves yield/risk unchanged', () => {
  const original = riskMeasures(bullet, 0.10, effective)
  const scaled = bullet.map(flow => ({ ...flow, amount: flow.amount * 10 }))
  const risk = riskMeasures(scaled, 0.10, effective)
  near(risk.price, original.price * 10)
  near(risk.macaulayDuration, original.macaulayDuration)
  near(risk.modifiedDuration, original.modifiedDuration)
  near(yieldFromPrice(scaled, original.price * 10, effective), 0.10)
})

test('input order is irrelevant and no schedule is mutated', () => {
  const flows = Object.freeze(bullet.toReversed().map(flow => Object.freeze({ ...flow })))
  near(priceFromYield(flows, 0.11, effective), priceFromYield(bullet, 0.11, effective))
  near(yieldFromPrice(flows, 100, effective), 0.10)
})

test('invalid flows, inputs, conventions and numeric range fail explicitly', () => {
  for (const flows of [[], null, [{ time: 0, amount: 100 }], [{ time: -1, amount: 100 }],
    [{ time: 1, amount: -1 }], [{ time: 1, amount: 0 }], [{ time: NaN, amount: 10 }],
    [{ time: 1, amount: '100' }], [{ time: 1, amount: Infinity }], [null]]) {
    assert.throws(() => priceFromYield(flows, 0.1, effective))
    assert.throws(() => yieldFromPrice(flows, 100, effective))
  }
  for (const options of [undefined, {}, { basis: 'unknown' },
    { basis: 'nominal' }, { basis: 'nominal', frequency: 0 },
    { basis: 'nominal', frequency: 1.5 }, { basis: 'effective-annual', frequency: 2 }]) {
    assert.throws(() => priceFromYield(bullet, 0.1, options))
  }
  for (const price of [0, -1, NaN, Infinity, '100']) {
    assert.throws(() => yieldFromPrice(bullet, price, effective))
  }
  for (const rate of [-1, -2, NaN, Infinity, '0.1']) {
    assert.throws(() => priceFromYield(bullet, rate, effective))
  }
  assert.throws(() => priceFromYield(bullet, -2, semiannual))
  assert.throws(() => nominalToEffective(0.1, 0))
  assert.throws(() => effectiveToNominal(-1, 2))
  assert.throws(() => nominalToEffective(-2, 2))
  assert.throws(() => nominalToEffective(1e300, 12))
  assert.throws(() => priceFromYield([{ time: 1e8, amount: 100 }], -0.99, effective))
  assert.throws(() => priceFromYield([{ time: 1e8, amount: 100 }], 10, effective))
  assert.throws(() => yieldFromPrice(bullet, 100, { ...effective, maxIterations: 0 }))
  assert.throws(() => yieldFromPrice(bullet, 100, { ...effective, relativeTolerance: 0 }))
})

test('iteration exhaustion and unrepresentable near-minus-100% returns absence of result', () => {
  assert.equal(yieldFromPrice(bullet, 96, { ...effective, maxIterations: 1 }), null)
  assert.equal(yieldFromPrice([{ time: 0.001, amount: 100 }], 1e300, effective), null)
})
