import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import {
  analyzeBond,
  calcDays360EU,
  calcMacaulayDuration,
  calcAccruedInterest,
  calcYTM,
  daysBetween,
  formatLocalDate,
  getNextBusinessDay,
  getSettlementDate,
  processCashflows,
} from '../src/utils/bondEngine.js'
import prospectos from '../src/data/bondProspectos.json' with { type: 'json' }

const closeTo = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Number.isFinite(actual), `Expected a finite number, received ${actual}`)
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`)
}

test('business days roll weekends and configured holidays forward', () => {
  assert.equal(formatLocalDate(getNextBusinessDay('2026-01-01')), '2026-01-02')
  assert.equal(formatLocalDate(getNextBusinessDay('2026-01-03')), '2026-01-05')
  assert.equal(formatLocalDate(getSettlementDate(new Date(2026, 0, 2, 23, 30))), '2026-01-05')
})

test('invalid civil dates are rejected instead of silently rolling into another month', () => {
  for (const value of ['2026-02-30', '2026-13-01', 'invalid', '', null]) {
    assert.equal(getNextBusinessDay(value), null)
  }
  assert.equal(getSettlementDate(new Date('invalid')), null)
  assert.equal(formatLocalDate(new Date('invalid')), null)
})

test('cashflow dates remain local in both positive and negative UTC offsets', () => {
  const originalTimezone = process.env.TZ
  try {
    for (const timezone of ['Asia/Tokyo', 'America/Argentina/Buenos_Aires']) {
      process.env.TZ = timezone
      const flows = processCashflows([
        { date: '2026-01-01', amortization_pct: 100, interest_pct: 5 },
      ], new Date(2025, 11, 31), 365)
      assert.equal(formatLocalDate(getNextBusinessDay('2026-01-01')), '2026-01-02')
      assert.equal(flows[0].date, '2026-01-02')
      assert.equal(flows[0].days, 2)
      assert.equal(flows[0].rawDays, 1)
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  }
})

test('calendar day count ignores time of day and keeps the 30E/360 convention', () => {
  assert.equal(daysBetween(new Date(2026, 0, 1, 23), new Date(2026, 0, 2, 1)), 1)
  assert.equal(calcDays360EU(new Date(2026, 0, 31), new Date(2026, 2, 31)), 60)
})

test('cashflows keep theoretical accrual dates separate from adjusted payment dates', () => {
  const raw = [
    { date: '2026-07-04', amortization_pct: 100, interest_pct: 4 },
    { date: '2026-01-02', amortization_pct: 0, interest_pct: 4 },
  ]
  const flows = processCashflows(raw, '2026-01-02', 360)
  assert.equal(flows[0].rawDate, '2026-01-02')
  assert.equal(flows[1].rawDate, '2026-07-04')
  assert.equal(flows[1].date, '2026-07-06')
  assert.equal(flows[1].rawDays, 182)
  assert.equal(flows[1].totalAmt, 104)
  assert.equal(raw[0].date, '2026-07-04', 'processing must not mutate source order')
})

test('malformed schedules fail together rather than producing incomplete valuations', () => {
  const valid = { date: '2027-01-04', amortization_pct: 100, interest_pct: 4 }
  for (const invalid of [null, { ...valid, date: '2026-02-30' },
    { ...valid, interest_pct: '4' }, { ...valid, amortization_pct: NaN }]) {
    assert.deepEqual(processCashflows([valid, invalid], '2026-01-02'), [])
    assert.equal(analyzeBond(100, { cashflows: [valid, invalid] }, '2026-01-02'), null)
  }
  assert.deepEqual(processCashflows([valid], new Date('invalid')), [])
})

test('YTM converges for positive, zero and strongly negative yields', () => {
  const flow = [{ days: 182, t: 0.5, totalAmt: 100 }]
  for (const price of [20, 95, 100, 150, 500]) {
    const expected = (100 / price) ** 2 - 1
    closeTo(calcYTM(price, flow), expected)
  }
})

test('YTM values coupon payments consistently and reuses the actual discount times', () => {
  const flows = [
    { days: 180, t: 0.5, totalAmt: 4 },
    { days: 360, t: 1, totalAmt: 104 },
    { days: 0, t: 0, totalAmt: 4 },
  ]
  const yieldRate = calcYTM(100, flows)
  closeTo(yieldRate, 1.04 ** 2 - 1)
  const expectedDuration = (0.5 * 4 / 1.04 + 104 / 1.04 ** 2) / 100
  closeTo(calcMacaulayDuration(100, flows, yieldRate), expectedDuration)
})

test('financial solvers reject invalid prices and non-discountable flows', () => {
  const flows = [{ days: 365, t: 1, totalAmt: 105 }]
  for (const price of [0, -1, NaN, Infinity, '100']) {
    assert.equal(calcYTM(price, flows), null)
    assert.equal(analyzeBond(price, { cashflows: [] }), null)
  }
  assert.equal(calcYTM(100, [{ days: 1, t: 0, totalAmt: 100 }]), null)
  assert.equal(calcYTM(100, flows, 0), null)
  assert.equal(calcMacaulayDuration(100, flows, -1), null)
  assert.equal(calcMacaulayDuration(100, flows, NaN), null)
})

test('bond analysis preserves clean price, accrued interest and technical value conventions', () => {
  const metrics = analyzeBond(100, {
    coupon_rate: 8,
    maturity_date: '2027-01-02',
    dayConvention: 360,
    frequency: 2,
    cashflows: [
      { date: '2026-01-02', amortization_pct: 0, interest_pct: 4 },
      { date: '2026-07-02', amortization_pct: 0, interest_pct: 4 },
      { date: '2027-01-02', amortization_pct: 100, interest_pct: 4 },
    ],
  }, '2026-04-02')
  closeTo(metrics.accrued, 2)
  closeTo(metrics.cleanPrice, 98)
  closeTo(metrics.techValue, 102)
  closeTo(metrics.paridad, 100 / 102 * 100)
  assert.equal(metrics.futureFlows.length, 2)
  assert.ok(metrics.ytm > 0)
  assert.ok(metrics.duration > 0)
})

test('valid schedules with no remaining payments are distinguished from missing data', () => {
  const prospecto = { maturity_date: '2025-01-02', cashflows: [{ date: '2025-01-02', amortization_pct: 100, interest_pct: 4 }] }
  assert.deepEqual(analyzeBond(100, prospecto, '2026-01-02'), { isMatured: true })
  assert.equal(analyzeBond(100, { cashflows: [] }, '2026-01-02'), null)
})

test('an exhausted schedule cannot declare a future contractual maturity expired', () => {
  assert.equal(analyzeBond(100, prospectos.CP39D, '2026-10-28'), null)
  assert.equal(analyzeBond(100, prospectos.CS47D, '2026-10-28'), null)
})

test('unknown accrual history stays absent while future-price yield remains indicative', () => {
  const result = analyzeBond(100, { maturity_date: '2027-07-17', coupon_rate: 8, frequency: 2,
    dayConvention: 360, cashflows: [
      { date: '2027-01-17', interest_pct: 4, amortization_pct: 0 },
      { date: '2027-07-17', interest_pct: 4, amortization_pct: 100 },
    ] }, '2026-10-28')
  assert.ok(result.ytm > 0)
  assert.equal(result.accrued, null)
  assert.equal(result.cleanPrice, null)
  assert.equal(result.paridad, null)
})

test('the shipped prospectus data never emits NaN or infinity in numeric metrics', () => {
  for (const [symbol, prospecto] of Object.entries(prospectos)) {
    if (symbol.startsWith('_')) continue
    const metrics = analyzeBond(100, prospecto, '2026-10-27')
    if (!metrics) continue
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${symbol}.${key}`)
    }
  }
})

test('accrual coupon boundaries use civil dates when 30E/360 assigns equal counts', () => {
  const prospecto = { coupon_rate: 8, frequency: 2, dayConvention: 360, emission_date: '2025-07-30',
    maturity_date: '2027-01-30', cashflows: [
      { date: '2026-07-30', interest_pct: 4, amortization_pct: 0 },
      { date: '2026-01-30', interest_pct: 4, amortization_pct: 0 },
      { date: '2027-01-30', interest_pct: 4, amortization_pct: 100 },
    ] }
  const flows = processCashflows(prospecto.cashflows, '2026-01-31', 360)
  assert.equal(flows[0].rawDate, '2026-01-30')
  closeTo(calcAccruedInterest(flows, prospecto, '2026-01-31'), 0)
})
