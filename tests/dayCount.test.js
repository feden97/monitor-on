import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import { dayCountDays, yearFraction, DAY_COUNT_CONVENTIONS, DAY_COUNT_VERSION } from '../src/utils/dayCount.js'

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12,
  `${actual} differs from ${expected}`)

test('actual conventions distinguish leap-year numerators from fixed denominators', () => {
  assert.equal(dayCountDays('2024-01-01', '2025-01-01', 'ACT/360'), 366)
  near(yearFraction('2024-01-01', '2025-01-01', 'ACT/360'), 366 / 360)
  near(yearFraction('2024-01-01', '2025-01-01', 'ACT/365F'), 366 / 365)
  assert.equal(yearFraction('2023-01-01', '2024-01-01', 'ACT/365F'), 1)
  // Reference dates also appear in the independent Strata day-count fixtures.
  assert.equal(dayCountDays('2011-12-28', '2012-02-29', 'ACT/360'), 63)
  near(yearFraction('2011-12-28', '2012-02-29', 'ACT/365F'), 63 / 365)
})

test('European and US bond bases differ when an unadjusted start precedes day 30', () => {
  assert.equal(dayCountDays('2026-01-29', '2026-03-31', '30E/360'), 61)
  assert.equal(dayCountDays('2026-01-29', '2026-03-31', '30/360-BOND'), 62)
  assert.equal(dayCountDays('2026-01-31', '2026-02-28', '30E/360'), 28)
  assert.equal(dayCountDays('2026-01-31', '2026-02-28', '30/360-BOND'), 28)
})

test('US EOM February is explicit and differs from both European and bond basis rules', () => {
  for (const [start, end, european, bond, eom] of [
    ['2026-02-28', '2026-03-31', 32, 33, 30],
    ['2024-02-29', '2024-03-31', 31, 32, 30],
    ['2024-02-29', '2025-02-28', 359, 359, 360],
    ['2011-02-28', '2012-02-28', 360, 360, 358],
    ['2011-02-28', '2012-02-29', 361, 361, 360],
  ]) {
    assert.equal(dayCountDays(start, end, '30E/360'), european)
    assert.equal(dayCountDays(start, end, '30/360-BOND'), bond)
    assert.equal(dayCountDays(start, end, '30U/360', { endOfMonth: false }), bond)
    assert.equal(dayCountDays(start, end, '30U/360', { endOfMonth: true }), eom)
    assert.equal(dayCountDays(start, end, '30U/360-EOM'), eom)
  }
})

test('regular half-year dates used by YPF produce exactly half a 30/360 year', () => {
  for (const convention of ['30E/360', '30/360-BOND', '30U/360-EOM']) {
    assert.equal(dayCountDays('2026-07-17', '2027-01-17', convention), 180)
    assert.equal(yearFraction('2026-07-17', '2027-01-17', convention), 0.5)
  }
  assert.notEqual(yearFraction('2026-07-17', '2027-01-17', 'ACT/360'), 0.5)
})

test('civil-day counting is invariant to browser timezone and daylight saving', () => {
  const original = process.env.TZ
  try {
    for (const timezone of ['America/Argentina/Buenos_Aires', 'America/New_York', 'Asia/Tokyo']) {
      process.env.TZ = timezone
      assert.equal(dayCountDays('2026-03-07', '2026-03-09', 'ACT/365F'), 2)
      assert.equal(dayCountDays('2026-10-31', '2026-11-02', 'ACT/365F'), 2)
      assert.equal(dayCountDays('2024-02-29', '2024-03-31', '30U/360-EOM'), 30)
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})

test('same-date result is zero, with explicit choices and no mutation', () => {
  assert.equal(DAY_COUNT_VERSION, 'day-count-1.0.0')
  for (const definition of DAY_COUNT_CONVENTIONS) {
    const options = Object.freeze(definition.requiresEndOfMonth ? { endOfMonth: true } : {})
    assert.equal(yearFraction('2026-01-17', '2026-01-17', definition.id, options), 0)
  }
  assert.ok(Object.isFrozen(DAY_COUNT_CONVENTIONS))
})

test('ambiguous conventions, invalid dates and reversed dates fail explicitly', () => {
  for (const convention of [undefined, null, '', 360, '30/360', 'ACT/365', '30E/360-ISDA']) {
    assert.throws(() => yearFraction('2026-01-01', '2027-01-01', convention))
  }
  for (const value of ['2026-02-30', '2026-13-01', '2026-1-01', '2026-01-01T00:00:00Z',
    '0000-01-01', '10000-01-01', '1900-02-29', null, new Date('2026-01-01')]) {
    assert.throws(() => dayCountDays(value, '2027-01-01', 'ACT/360'))
  }
  assert.equal(dayCountDays('2000-02-28', '2000-03-01', 'ACT/360'), 2)
  assert.throws(() => yearFraction('2027-01-01', '2026-01-01', '30U/360-EOM'), /precede/)
  assert.throws(() => yearFraction('2026-01-01', '2027-01-01', '30U/360'), /endOfMonth/)
  assert.throws(() => yearFraction('2026-01-01', '2027-01-01', '30U/360', { endOfMonth: 1 }))
  assert.throws(() => yearFraction('2026-01-01', '2027-01-01', '30U/360-EOM', { endOfMonth: false }))
  assert.throws(() => yearFraction('2026-01-01', '2027-01-01', '30/360-BOND', { endOfMonth: true }))
})
