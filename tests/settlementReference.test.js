import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateSettlementDate } from '../src/utils/settlementReference.js'
import { buildBondMarketModel } from '../src/utils/bondModel.js'
import prospectos from '../src/data/bondProspectos.json' with { type: 'json' }

test('reference settlement respects bank-specific and extraordinary closures and names its center', () => {
  const argentina = estimateSettlementDate('2026-11-05')
  assert.equal(argentina.date, '2026-11-11')
  assert.equal(argentina.calendar.calendars[0].id, 'AR-BANK')
  assert.match(argentina.note, /no están confirmados/)
  assert.equal(estimateSettlementDate('2026-11-05', ['AR-BANK', 'US-NY-FED']).date, '2026-11-12')
  assert.equal(estimateSettlementDate('2026-10-27').date, '2026-10-28')
})

test('no reference settlement is invented outside coverage and the market model remains usable', () => {
  const reference = estimateSettlementDate('2027-01-04')
  assert.equal(reference.date, null)
  assert.equal(reference.status, 'out-of-coverage')
  const model = buildBondMarketModel([{ symbol: 'YM34D', c: 100 }], prospectos, null,
    new Date(2027, 0, 4), new Map(), { settlementReference: reference })
  assert.equal(model.rows[0].ytm, null)
  assert.equal(model.rows[0].daysToMaturity, null)
  assert.equal(model.rows[0].calculationSnapshot.settlementDate, null)
  assert.ok(model.rows[0].contract.documents.length > 0)
})
