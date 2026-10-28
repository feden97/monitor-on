import test from 'node:test'
import assert from 'node:assert/strict'
import { contractualFlows, verifyDocuments, compareCatalog } from './ypf-case.mjs'

test('official YPF regular coupons reduce on outstanding principal after amortization', () => {
  const f = contractualFlows()
  assert.equal(f.length, 18)
  assert.equal(f[0].date, '2025-07-17')
  assert.equal(f.reduce((sum, row) => sum + row.principal, 0), 100)
  const expected = [
    ['2032-01-17', 4.125, 30], ['2032-07-17', 2.8875, 0],
    ['2033-01-17', 2.8875, 30], ['2033-07-17', 1.65, 0], ['2034-01-17', 1.65, 40],
  ]
  for (const [date, interest, principal] of expected) {
    const row = f.find(row => row.date === date)
    assert.ok(Math.abs(row.interest - interest) < 1e-10)
    assert.equal(row.principal, principal)
  }
})

test('archived documents match their SHA-256 provenance manifest', () => {
  assert.equal(verifyDocuments().length, 3)
})

test('catalog comparison detects coupon errors and missing payment dates', () => {
  const stored = contractualFlows().map(f => ({ date: f.date, interest_pct: f.interest, amortization_pct: f.principal }))
  const good = compareCatalog({ YM34D: { cashflows: stored } })
  assert.deepEqual(good.differences, [])
  assert.deepEqual(good.originalDatesAbsentFromCatalog, [])
  const bad = stored.map(f => ({ ...f }))
  bad.find(f => f.date === '2032-07-17').interest_pct = 4.125
  bad.pop()
  const report = compareCatalog({ YM34D: { cashflows: bad } })
  assert.deepEqual(report.differences, [{ date: '2032-07-17', reason: 'amount_or_date_differs' }])
  assert.deepEqual(report.originalDatesAbsentFromCatalog, ['2034-01-17'])
})

test('zero-value markers are reported separately and malformed amounts cannot pass', () => {
  const report = compareCatalog({ YM34D: { cashflows: [
    { date: '2025-01-17', interest_pct: 0, amortization_pct: 0 },
    { date: '2025-07-17', interest_pct: 'bad', amortization_pct: 0 },
  ] } })
  assert.deepEqual(report.ignoredZeroMarkers, ['2025-01-17'])
  assert.deepEqual(report.differences, [{ date: '2025-07-17', reason: 'invalid_amount' }])
  assert.deepEqual(compareCatalog({ YM34D: { cashflows: {} } }).differences,
    [{ reason: 'missing_or_invalid_schedule' }])
})
