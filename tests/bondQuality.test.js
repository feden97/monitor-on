import test from 'node:test'
import assert from 'node:assert/strict'
import { assessBondQuality, assessSchedule, FINANCIAL_ENGINE_VERSION } from '../src/utils/bondQuality.js'
import { buildBondMarketModel } from '../src/utils/bondModel.js'
import { auditedContracts } from '../src/data/contracts.js'
import prospectos from '../src/data/bondProspectos.json' with { type: 'json' }

const settlement = '2026-10-28'
const asOf = new Date('2026-10-27T20:00:00Z')
const quote = { symbol: 'YM34D', c: 100, source: 'test-provider' }
const ypf = prospectos.YM34D

test('contract, schedule, market time and calendar are independent states', () => {
  const q = assessBondQuality(ypf, settlement, { quote, asOf, contract: auditedContracts.YM34D })
  assert.equal(q.contract.status, 'reviewed-original')
  assert.equal(q.schedule.status, 'complete')
  assert.equal(q.market.status, 'unknown-time')
  assert.equal(q.calendar.status, 'partial')
  assert.equal(q.calculation.status, 'indicative')
  assert.equal(q.canCalculate, true)
  assert.equal(q.rankingEligible, false)
})

test('incomplete and contradictory schedules never produce trusted metrics', () => {
  assert.equal(assessSchedule(prospectos.CP39D, settlement).status, 'incomplete')
  assert.equal(assessSchedule(prospectos.CS47D, settlement).status, 'contradictory')
  for (const symbol of ['CP39D', 'CS47D']) {
    const model = buildBondMarketModel([{ symbol, c: 100 }], prospectos,
      new Date(`${settlement}T00:00:00`), new Date('2026-10-27T00:00:00'), new Map(), { asOf })
    assert.equal(model.rows[0].ytm, null)
    assert.equal(model.rows[0].duration, null)
    assert.equal(model.rows[0].paridad, null)
    assert.equal(model.rows[0].quality.canCalculate, false)
  }
  const empty = assessSchedule({ maturity_date: '2034-01-17', cashflows: [] }, settlement)
  assert.equal(empty.status, 'missing')
  assert.equal(assessSchedule({ maturity_date: '2025-01-17', cashflows: [] }, settlement).status, 'matured')
})

test('one distant redemption cannot hide absent coupons, nor can zero markers', () => {
  const schedule = { maturity_date: '2034-01-17', coupon_rate: 8.25, frequency: 2,
    cashflows: [{ date: '2027-01-17', amortization_pct: 0, interest_pct: 0 },
      { date: '2034-01-17', amortization_pct: 100, interest_pct: 4.125 }] }
  assert.equal(assessSchedule(schedule, settlement).status, 'incomplete')
  assert.equal(assessSchedule({ ...schedule, cashflows: {} }, settlement).status, 'missing')
  assert.equal(assessSchedule({ maturity_date: '2027-01-17', coupon_rate: 8, frequency: 2,
    cashflows: [{ date: '2026-01-17', interest_pct: 4, amortization_pct: 0 },
      { date: '2026-07-17', interest_pct: 0, amortization_pct: 50 },
      { date: '2027-01-17', interest_pct: 2, amortization_pct: 50 }] }, '2026-04-17').status, 'incomplete')
})

test('receipt time cannot make an unknown trade timestamp current', () => {
  const receiptOnly = assessBondQuality(ypf, settlement, { quote: { ...quote, receivedAt: asOf.toISOString() }, asOf })
  assert.equal(receiptOnly.market.status, 'unknown-time')
  const stale = assessBondQuality(ypf, settlement, {
    quote: { ...quote, marketTimestamp: '2026-10-27T18:00:00Z' }, asOf,
  })
  assert.equal(stale.market.status, 'stale')
  const current = assessBondQuality(ypf, settlement, {
    quote: { ...quote, marketTimestamp: '2026-10-27T19:59:00Z' }, asOf,
  })
  assert.equal(current.market.status, 'current')
  assert.equal(current.rankingEligible, false)
})

test('a clean quote cannot be discounted knowingly as a dirty price', () => {
  const q = assessBondQuality(ypf, settlement, { quote: { ...quote, priceType: 'clean' }, asOf })
  assert.equal(q.canCalculate, false)
  assert.match(q.calculation.reasons.join(' '), /limpio/)
  const residual = assessBondQuality(ypf, settlement, { quote: { ...quote, faceValueBasis: 'residual' }, asOf })
  assert.equal(residual.canCalculate, false)
  assert.match(residual.calculation.reasons.join(' '), /nominal residual/)
})

test('reviewed original issuance cannot certify later events, mapping and market conventions', () => {
  const q = assessBondQuality(ypf, '2025-01-18', { asOf,
    quote: { ...quote, marketTimestamp: '2026-10-27T19:59:00Z', priceType: 'dirty',
      faceValueBasis: 'original', settlementTerm: '24hs', settlementDate: '2025-01-18' },
    contract: auditedContracts.YM34D,
  })
  assert.equal(q.contract.status, 'reviewed-original')
  assert.equal(q.rankingEligible, false)
})

test('a mismatch to original terms is blocked even with a structurally complete schedule', () => {
  const q = assessBondQuality({ ...ypf, coupon_rate: 9 }, settlement,
    { quote, asOf, contract: auditedContracts.YM34D })
  assert.equal(q.schedule.status, 'complete')
  assert.equal(q.contract.status, 'contradictory')
  assert.equal(q.canCalculate, false)
})

test('snapshot records full flows, assumptions, yield bases and explicit absence of market time', () => {
  const model = buildBondMarketModel([quote], prospectos, new Date(`${settlement}T00:00:00`),
    new Date('2026-10-27T00:00:00'), new Map(), { asOf, receivedAt: new Date('2026-10-27T20:00:00Z') })
  const snapshot = model.rows[0].calculationSnapshot
  assert.equal(snapshot.format, 'monitor-on-calculation/v1')
  assert.equal(snapshot.instrumentId, auditedContracts.YM34D.instrumentId)
  assert.deepEqual(snapshot.documentaryEvidence.map(document => document.sha256),
    auditedContracts.YM34D.documents.map(document => document.sha256))
  assert.equal(snapshot.engineVersion, FINANCIAL_ENGINE_VERSION)
  assert.equal(snapshot.dayCount, '30E/360')
  assert.equal(snapshot.price.type, 'dirty-assumed')
  assert.equal(snapshot.price.marketTimestamp, null)
  assert.equal(snapshot.price.receivedAt, '2026-10-27T20:00:00.000Z')
  assert.equal(snapshot.rawCashflows.length, ypf.cashflows.length)
  assert.equal(model.rows[0].nextCouponDate, null)
  assert.equal(snapshot.cashflows[0].adjustedDate, null)
  assert.equal(snapshot.cashflows[0].paymentDateStatus, 'not-verified')
  assert.ok(snapshot.cashflows.length > 0)
  assert.equal(snapshot.outputs.ytm, model.rows[0].ytm)
  assert.ok(snapshot.assumptions.some(s => s.includes('sucio')))
  const serialized = JSON.parse(JSON.stringify(snapshot))
  assert.equal(serialized.cashflows[0].yearFraction, snapshot.cashflows[0].yearFraction)
})

test('freshness is reassessed on time change without recomputing unchanged financial metrics', () => {
  const timedQuote = { ...quote, marketTimestamp: '2026-10-27T19:59:00Z' }
  const first = buildBondMarketModel([timedQuote], prospectos, new Date(`${settlement}T00:00:00`),
    new Date('2026-10-27T00:00:00'), new Map(), { asOf })
  const next = buildBondMarketModel([timedQuote], prospectos, new Date(`${settlement}T00:00:00`),
    new Date('2026-10-27T00:00:00'), first.metricsCache, { asOf: new Date('2026-10-27T21:00:00Z') })
  assert.equal(first.rows[0].quality.market.status, 'current')
  assert.equal(next.rows[0].quality.market.status, 'stale')
  assert.equal(first.rows[0].metrics, next.rows[0].metrics)
})

test('a solver without a representable yield clears all dependent displayed metrics', () => {
  const metadata = { coupon_rate: 0, frequency: 2, dayConvention: 360,
    maturity_date: '2027-01-17', cashflows: [{ date: '2027-01-17', interest_pct: 0, amortization_pct: 100 }] }
  const model = buildBondMarketModel([{ symbol: 'TESTD', c: 1e300 }], { TESTD: metadata },
    new Date(`${settlement}T00:00:00`), new Date('2026-10-27T00:00:00'))
  const row = model.rows[0]
  assert.equal(row.quality.calculation.status, 'blocked')
  assert.equal(row.metrics, null)
  assert.equal(row.ytm, null)
  assert.equal(row.paridad, null)
  assert.equal(row.duration, null)
  assert.equal(row.calculationSnapshot.outputs, null)
})
