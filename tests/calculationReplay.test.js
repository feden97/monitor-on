import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBondMarketModel } from '../src/utils/bondModel.js'
import { replayCalculation } from '../src/utils/calculationReplay.js'
import { auditedContracts } from '../src/data/contracts.js'
import { readFileSync } from 'node:fs'

function originalYpfSnapshot() {
  const terms = auditedContracts.YM34D
  const prospecto = { coupon_rate: terms.annualCouponRate * 100, frequency: terms.frequency,
    emission_date: terms.issueDate, maturity_date: terms.maturityDate, dayConvention: 360,
    cashflows: terms.cashflows }
  return buildBondMarketModel([{ symbol: 'YM34D', c: 100, source: 'test-scenario' }],
    { YM34D: prospecto }, new Date(2026, 9, 28), new Date(2026, 9, 27)).rows[0].calculationSnapshot
}

test('downloaded snapshot reproduces rates after JSON roundtrip without clock, APIs or live catalog', () => {
  const snapshot = JSON.parse(JSON.stringify(originalYpfSnapshot()))
  const result = replayCalculation(snapshot)
  assert.equal(result.status, 'reproduced')
  assert.deepEqual(result.differences, [])
  assert.ok(result.computed.ytm > 0)
  snapshot.outputs.ytm += 1
  assert.equal(replayCalculation(snapshot).status, 'differs')
})

test('replay refuses unsupported, blocked or malformed calculations', () => {
  for (const change of [
    { format: 'unknown' }, { engineVersion: 'unknown' }, { cashflows: [] },
    { quality: { calculation: { status: 'blocked' } } },
    { price: { value: 0 } }, { scenario: 'yield-to-worst' },
    { cashflows: [{ yearFraction: -1, total: 100 }] },
  ]) assert.throws(() => replayCalculation({ ...originalYpfSnapshot(), ...change }))
})

test('historical engine 2.0 snapshots remain numerically reproducible after the day-count upgrade', () => {
  const archived = JSON.parse(readFileSync(new URL('../research/fixed-income/output/ym34d-scenario-2026-10-28.json', import.meta.url), 'utf8'))
  assert.equal(archived.engineVersion, 'fixed-income-2.0.0')
  assert.equal(replayCalculation(archived).status, 'reproduced')
})
