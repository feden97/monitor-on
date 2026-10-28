import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import {
  addBusinessDays, adjustBusinessDay, advanceCivilDate, CALENDARS,
  getCalendarCoverage, isBusinessDay, parseCivilDate, tryAdjustBusinessDay,
} from '../src/utils/businessCalendar.js'

const joint = ['AR-BANK', 'US-NY-FED']

test('joint business dates require every financial center to be open', () => {
  assert.equal(isBusinessDay('2026-10-28', joint), true)
  assert.equal(isBusinessDay('2026-11-06', 'AR-BANK'), false)
  assert.equal(isBusinessDay('2026-11-06', 'US-NY-FED'), true)
  assert.equal(isBusinessDay('2026-11-11', 'AR-BANK'), true)
  assert.equal(isBusinessDay('2026-11-11', 'US-NY-FED'), false)
  assert.equal(isBusinessDay('2026-11-11', joint), false)
})

test('BCRA bank-specific, tourism and extraordinary holidays are distinct from weekends', () => {
  for (const date of ['2026-03-23', '2026-07-10', '2026-11-06', '2026-11-09', '2026-11-10', '2026-12-07']) {
    assert.equal(isBusinessDay(date, 'AR-BANK'), false, date)
  }
  assert.equal(adjustBusinessDay('2026-11-06', 'AR-BANK'), '2026-11-11')
  assert.equal(adjustBusinessDay('2026-11-06', joint), '2026-11-12')
})

test('business-day addition counts open days, excludes the start and supports either direction', () => {
  assert.equal(addBusinessDays('2026-11-05', 1, 'AR-BANK'), '2026-11-11')
  assert.equal(addBusinessDays('2026-11-05', 1, joint), '2026-11-12')
  assert.equal(addBusinessDays('2026-11-12', -1, joint), '2026-11-05')
  assert.equal(addBusinessDays('2026-10-30', 1, joint), '2026-11-02')
  assert.equal(addBusinessDays('2026-10-31', 0, joint), '2026-10-31')
})

test('following, modified following, preceding and unadjusted are explicit rules', () => {
  assert.equal(adjustBusinessDay('2026-10-31', joint, 'following'), '2026-11-02')
  assert.equal(adjustBusinessDay('2026-10-31', joint, 'modified-following'), '2026-10-30')
  assert.equal(adjustBusinessDay('2026-11-07', joint, 'preceding'), '2026-11-05')
  assert.equal(adjustBusinessDay('2026-10-31', joint, 'unadjusted'), '2026-10-31')
  assert.throws(() => adjustBusinessDay('2026-10-31', joint, 'guess'), { code: 'UNKNOWN_ADJUSTMENT_RULE' })
})

test('New York Fed Saturday observance differs from the federal employee calendar', () => {
  for (const date of ['2026-07-03', '2027-06-18', '2027-12-24', '2027-12-31']) {
    assert.equal(isBusinessDay(date, 'US-NY-FED'), true, date)
  }
  assert.equal(adjustBusinessDay('2027-07-04', 'US-NY-FED'), '2027-07-06')
  assert.equal(adjustBusinessDay('2027-01-17', 'US-NY-FED'), '2027-01-19')
})

test('coverage is an explicit interval, not the date of the final holiday', () => {
  assert.equal(isBusinessDay('2026-12-31', 'AR-BANK'), true)
  assert.equal(getCalendarCoverage(joint).to, '2026-12-31')
  assert.equal(getCalendarCoverage('US-NY-FED').to, '2027-12-31')
  assert.throws(() => isBusinessDay('2027-01-17', joint), { code: 'CALENDAR_OUT_OF_COVERAGE' })
  const notKnown = tryAdjustBusinessDay('2027-01-17', joint)
  assert.equal(notKnown.date, null)
  assert.equal(notKnown.status, 'out-of-coverage')
  assert.match(notKnown.reason, /AR-BANK/)
  assert.throws(() => addBusinessDays('2026-12-31', 1, joint), { code: 'CALENDAR_OUT_OF_COVERAGE' })
  assert.throws(() => adjustBusinessDay('2026-01-01', 'AR-BANK', 'preceding'), { code: 'CALENDAR_OUT_OF_COVERAGE' })
})

test('civil dates reject rollover, timezone ambiguity and unknown calendars', () => {
  for (const date of ['2026-02-30', '2026-13-01', '2026-10-28T00:00:00Z', '', null, new Date()]) {
    assert.throws(() => parseCivilDate(date), { code: 'INVALID_CIVIL_DATE' })
  }
  assert.throws(() => isBusinessDay('2026-10-28', []), { code: 'UNKNOWN_CALENDAR' })
  assert.throws(() => isBusinessDay('2026-10-28', ['__proto__']), { code: 'UNKNOWN_CALENDAR' })
  assert.throws(() => advanceCivilDate('2026-10-28', 1.5), { code: 'INVALID_DAY_COUNT' })
  assert.equal(tryAdjustBusinessDay('bad', joint).status, 'invalid')
  assert.equal(advanceCivilDate('2026-12-31', 1), '2027-01-01')
})

test('civil arithmetic and calendar evaluation are independent of browser timezone', () => {
  const original = process.env.TZ
  try {
    for (const timezone of ['Asia/Tokyo', 'America/Argentina/Buenos_Aires', 'America/New_York']) {
      process.env.TZ = timezone
      assert.equal(adjustBusinessDay('2026-11-06', joint), '2026-11-12')
      assert.equal(advanceCivilDate('2026-03-08', 1), '2026-03-09')
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})

test('calendar versions and holiday evidence are immutable and resolve to primary sources', () => {
  for (const calendar of Object.values(CALENDARS)) {
    assert.ok(Object.isFrozen(calendar))
    assert.ok(calendar.holidays.every(holiday => holiday.sourceIds.length > 0))
    assert.ok(calendar.sources.every(source => source.url.startsWith('https://')))
  }
  assert.throws(() => { CALENDARS['AR-BANK'].coverage.to = '2034-12-31' }, TypeError)
})
