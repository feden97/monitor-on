import test from 'node:test'
import assert from 'node:assert/strict'
import { auditedContracts } from '../src/data/contracts.js'
import { calculateBondScenario } from '../src/utils/bondScenario.js'
import { replayCalculation } from '../src/utils/calculationReplay.js'
import { analyzeBond, processCashflows } from '../src/utils/bondEngine.js'
import prospectos from '../src/data/bondProspectos.json' with { type: 'json' }

const contract = auditedContracts.YM34D
const inputs = { price: 109.05, priceType: 'dirty', nominalBasis: 'original',
  settlementDate: '2026-10-28', accrualDayCount: '30E/360', discountDayCount: '30E/360' }
const near = (a, b, tolerance = 1e-8) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} vs ${b}`)

test('manual original YPF scenario reproduces the established numerical case', () => {
  const result = calculateBondScenario(contract, inputs)
  near(result.outputs.ytm, 7.02852143901775)
  near(result.outputs.accrued, 8.25 * 101 / 360)
  near(result.outputs.cleanPrice + result.outputs.accrued, inputs.price)
  const prior = analyzeBond(inputs.price, prospectos.YM34D, inputs.settlementDate)
  near(result.outputs.ytm, prior.ytm)
  assert.equal(result.snapshot.price.source, 'manual-scenario')
  assert.equal(result.snapshot.quality.calculation.status, 'indicative')
})

test('clean and dirty input prices lead to the same normalized valuation', () => {
  const dirty = calculateBondScenario(contract, inputs)
  const clean = calculateBondScenario(contract, { ...inputs, priceType: 'clean', price: dirty.outputs.cleanPrice })
  near(clean.outputs.dirtyPrice, dirty.outputs.dirtyPrice)
  near(clean.outputs.ytm, dirty.outputs.ytm)
})

test('residual and original VN prices agree after the documented first amortization', () => {
  const original = calculateBondScenario(contract, { ...inputs, settlementDate: '2032-02-17', price: 70 })
  const residual = calculateBondScenario(contract, { ...inputs, settlementDate: '2032-02-17', price: 100, nominalBasis: 'residual' })
  near(original.outputs.outstandingPrincipal, 70)
  near(original.outputs.accrued, 70 * 0.0825 / 12)
  near(original.outputs.ytm, residual.outputs.ytm)
  const cleanResidual = calculateBondScenario(contract, { ...inputs, settlementDate: '2032-02-17',
    price: original.outputs.cleanPrice * 100 / 70, priceType: 'clean', nominalBasis: 'residual' })
  near(cleanResidual.outputs.dirtyPrice, 70)
})

test('comparison changes discount convention only and keeps price and normalization fixed', () => {
  const result = calculateBondScenario(contract, inputs)
  const act360 = result.comparisons.find(row => row.convention === 'ACT/360')
  const act365 = result.comparisons.find(row => row.convention === 'ACT/365F')
  assert.ok(Math.abs(act360.ytm - act365.ytm) > 0.01)
  const changed = calculateBondScenario(contract, { ...inputs, discountDayCount: 'ACT/365F' })
  near(changed.outputs.dirtyPrice, result.outputs.dirtyPrice)
  near(changed.outputs.accrued, result.outputs.accrued)
  near(changed.outputs.ytm, act365.ytm)
})

test('missing joint calendar coverage remains unknown instead of inventing payment dates', () => {
  const result = calculateBondScenario(contract, inputs)
  assert.equal(result.calendar.to, '2026-12-31')
  assert.equal(result.cashflows[0].date, '2027-01-17')
  assert.equal(result.cashflows[0].adjustedDate, null)
  assert.equal(result.cashflows[0].referenceCalendarStatus, 'out-of-coverage')
  assert.ok(result.assumptions.some(text => text.includes('Following')))
})

test('manual snapshot survives JSON serialization and replays without external data', () => {
  const result = calculateBondScenario(contract, { ...inputs, priceType: 'clean', discountDayCount: 'ACT/365F' })
  const replay = replayCalculation(JSON.parse(JSON.stringify(result.snapshot)))
  assert.equal(replay.status, 'reproduced')
  near(replay.computed.ytm, result.outputs.ytm)
})

test('scenario rejects invalid inputs, noncontractual accrual bases and entitlement boundaries', () => {
  for (const changed of [{ price: 0 }, { price: Infinity }, { price: '100' }, { priceType: 'unknown' },
    { nominalBasis: 'unknown' }, { settlementDate: '2026-02-30' }, { settlementDate: '2025-01-16' },
    { settlementDate: '2034-01-17' }, { settlementDate: '2027-01-16' }, { settlementDate: '2027-01-17' },
    { discountDayCount: 360 }, { accrualDayCount: 'ACT/360' }, { accrualDayCount: 'ACT/365F' }]) {
    assert.throws(() => calculateBondScenario(contract, { ...inputs, ...changed }))
  }
  assert.throws(() => calculateBondScenario({ ...contract, instrumentId: 'other-bond' }, inputs))
})

test('main engine accepts explicit ACT/360 without conflating coupon accrual and discount', () => {
  const flows = processCashflows([{ date: '2027-10-28', amortization_pct: 100, interest_pct: 0 }], '2026-10-28', 'ACT/360')
  near(flows[0].t, 365 / 360)
  const metrics = analyzeBond(100, { ...prospectos.YM34D, discountDayCount: 'ACT/365F', accrualDayCount: '30E/360' }, '2026-10-28')
  const scenario = calculateBondScenario(contract, { ...inputs, price: 100, discountDayCount: 'ACT/365F' })
  near(metrics.ytm, scenario.outputs.ytm)
  near(metrics.accrued, scenario.outputs.accrued)
})
