import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marketDateKey } from '../src/utils/marketClock.js'

test('market civil day follows Argentina around UTC midnight', () => {
  assert.equal(marketDateKey('2026-10-28T01:00:00Z'), '2026-10-27')
  assert.equal(marketDateKey('2026-10-28T03:00:00Z'), '2026-10-28')
  assert.equal(marketDateKey('invalid'), null)
})
