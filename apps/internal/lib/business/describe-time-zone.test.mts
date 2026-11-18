// Run: npx tsx --test apps/internal/lib/business/describe-time-zone.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { describeTimeZone } from '@pts/ui/dates'

const NOVEMBER = new Date('2026-11-18T12:00:00Z')
const JULY = new Date('2026-07-15T12:00:00Z')

test('Chicago in November is Central Time, GMT−6', () => {
  assert.deepEqual(describeTimeZone('America/Chicago', NOVEMBER), {
    genericName: 'Central Time',
    shortGeneric: 'CT',
    offsetLabel: 'GMT−6',
    offsetMinutes: -360,
  })
})

test('the offset follows daylight saving', () => {
  const july = describeTimeZone('America/Chicago', JULY)
  assert.equal(july?.offsetLabel, 'GMT−5')
  assert.equal(july?.offsetMinutes, -300)
})

test('half-hour offsets keep their minutes', () => {
  const kolkata = describeTimeZone('Asia/Kolkata', NOVEMBER)
  assert.equal(kolkata?.offsetLabel, 'GMT+5:30')
  assert.equal(kolkata?.offsetMinutes, 330)
})

test('UTC is GMT with no offset', () => {
  const utc = describeTimeZone('UTC', NOVEMBER)
  assert.equal(utc?.offsetLabel, 'GMT')
  assert.equal(utc?.offsetMinutes, 0)
})

test('an unknown zone is null, not a throw', () => {
  assert.equal(describeTimeZone('Mars/Olympus_Mons', NOVEMBER), null)
})
