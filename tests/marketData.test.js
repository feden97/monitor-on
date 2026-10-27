import assert from 'node:assert/strict'
import { test } from 'node:test'
import { areBondListsEqual, transformBonds, transformMepData, transformRpData } from '../src/utils/marketData.js'

test('quotes skip malformed rows, normalize numbers, and sort without mutating the response', () => {
  const rows = [{ symbol: 'YPFO', c: '102000', v: Infinity }, null, { symbol: 123 }, { symbol: 'AL30' }, { symbol: 'YPFD', c: 101, pct_change: 0 }]
  const result = transformBonds(rows)
  assert.deepEqual(result.map((row) => row.symbol), ['YPFD', 'YPFO'])
  assert.equal(result[1].c, 102000)
  assert.equal(result[1].v, null)
  assert.equal(result[0].pct_change, 0)
  assert.equal(rows[0].c, '102000')
  assert.equal(areBondListsEqual(result, transformBonds(rows)), true)
  assert.equal(areBondListsEqual(result, transformBonds([{ symbol: 'YPFD', c: 102 }, rows[0]])), false)
})

test('MEP accepts both quote formats and safely falls back when the 24hs quote is null', () => {
  assert.deepEqual(transformMepData({ mep: { al30: { '24hs': { price: 1250 } } }, time: 100 }), { value: 1250, timestamp: 100000 })
  assert.equal(transformMepData({ mep: { al30: { '24hs': '1251' } } }).value, 1251)
  assert.equal(transformMepData({ mep: { al30: { '24hs': null, price: 1252 } } }).value, 1252)
  assert.equal(transformMepData({ mep: { al30: { '24hs': -1, price: 1253 } } }).value, 1253)
  for (const invalid of [null, {}, { mep: { al30: { price: Infinity } } }, { mep: { al30: { price: 0 } } }]) {
    assert.throws(() => transformMepData(invalid), /MEP válida/)
  }
})

test('country risk preserves zero, normalizes values, and rejects invalid data', () => {
  assert.deepEqual(transformRpData({ valor: '500', fecha: '2026-10-27' }), { value: 500, timestamp: '2026-10-27' })
  assert.equal(transformRpData({ valor: 0 }).value, 0)
  for (const valor of [null, '', -1, Infinity, true]) {
    assert.throws(() => transformRpData({ valor }), /riesgo país válido/)
  }
})
