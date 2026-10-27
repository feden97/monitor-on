import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBondMarketModel, compareBondValues } from '../src/utils/bondModel.js'

const today = new Date('2026-10-27T00:00:00')
const settlement = new Date('2026-10-28T00:00:00')
const prospecto = {
  name: 'Example issuer',
  ticker_o: 'EXAMPLEO',
  coupon_rate: 10,
  emission_date: '2026-01-01',
  maturity_date: '2027-11-01',
  rating: 'AA',
  cashflows: [
    { date: '2026-11-01', amortization_pct: 0, interest_pct: 5 },
    { date: '2027-11-01', amortization_pct: 100, interest_pct: 5 },
  ],
}

function build(bonds, previous = new Map(), prospectos = { TESTD: prospecto }, date = settlement) {
  return buildBondMarketModel(bonds, prospectos, date, today, previous)
}

test('one snapshot joins ARS quotes, metrics, coverage and business payment dates', () => {
  const quote = { symbol: 'TESTD', c: 100, q_op: 12 }
  const model = build([quote, { symbol: 'EXAMPLEO', c: 150000 }])
  assert.equal(model.rows.length, 1)
  assert.equal(model.rows[0].quote, quote)
  assert.equal(model.rows[0].priceArs, 150000)
  assert.equal(model.rows[0].metrics.dirtyPrice, 100)
  assert.equal(model.rows[0].nextCouponDate, '2026-11-02')
  assert.equal(model.rows[0].daysToCoupon, 6)
  assert.equal(model.coverageSummary.score, 100)
  assert.equal(model.coverageSummary.availableChecks, 4)
})

test('a quote refresh reuses unchanged metrics while retaining only current tickers', () => {
  const first = build([{ symbol: 'TESTD', c: 100 }, { symbol: 'MISSINGD', c: 95 }])
  const next = build([{ symbol: 'TESTD', c: 100, q_op: 25 }], first.metricsCache)
  assert.equal(next.rows[0].metrics, first.rows[0].metrics)
  assert.equal(next.rows[0].operations, 25)
  assert.equal(next.metricsCache.size, 1)
  assert.equal(first.metricsCache.size, 2)
})

test('price, prospectus and settlement updates invalidate cached metrics', () => {
  const quotes = [{ symbol: 'TESTD', c: 100 }]
  const first = build(quotes)
  const priceChange = build([{ symbol: 'TESTD', c: 102 }], first.metricsCache)
  assert.notEqual(priceChange.rows[0].metrics, first.rows[0].metrics)
  assert.equal(priceChange.rows[0].metrics.dirtyPrice, 102)

  const prospectusChange = build(quotes, first.metricsCache, { TESTD: { ...prospecto, coupon_rate: 8 } })
  assert.notEqual(prospectusChange.rows[0].metrics, first.rows[0].metrics)
  const settlementChange = build(quotes, first.metricsCache, { TESTD: prospecto }, new Date('2026-10-29T00:00:00'))
  assert.notEqual(settlementChange.rows[0].metrics, first.rows[0].metrics)
})

test('missing metadata and empty datasets produce consistent coverage', () => {
  const model = build([{ symbol: 'MISSINGD', c: 100 }])
  assert.equal(model.rows[0].name, 'MISSINGD')
  assert.equal(model.rows[0].tickerArs, 'MISSINGO')
  assert.equal(model.rows[0].metrics, null)
  assert.equal(model.coverageSummary.missingProspecto, 1)
  assert.equal(model.coverageSummary.missingRating, 1)
  assert.equal(model.coverageSummary.missingTickerArs, 1)
  assert.deepEqual(build([]).rows, [])
  assert.equal(build([]).coverageSummary, null)
})

test('missing text and numbers sort last in either direction without mutating source', () => {
  const names = ['YPF', null, 'Pampa', undefined]
  assert.deepEqual([...names].sort(compareBondValues), ['Pampa', 'YPF', null, undefined])
  assert.deepEqual([...names].sort((a, b) => compareBondValues(a, b, 'desc')), ['YPF', 'Pampa', null, undefined])
  const rows = [{ value: null }, { value: 2 }, { value: 0 }, { value: NaN }]
  assert.deepEqual([...rows].sort((a, b) => compareBondValues(a.value, b.value)).map(row => row.value), [0, 2, null, NaN])
  assert.deepEqual([...rows].sort((a, b) => compareBondValues(a.value, b.value, 'desc')).map(row => row.value), [2, 0, null, NaN])
  assert.equal(rows[0].value, null)
})
