import assert from 'node:assert/strict'
import { test } from 'node:test'

import { versionMs } from './types.ts'

const expected = Date.UTC(2026, 10, 6, 14, 20, 15, 123)

test('reads the timestamp Postgres prints', () => {
  assert.equal(versionMs('2026-11-06 14:20:15.123456+00'), expected)
})

test('reads ISO 8601 from JavaScript', () => {
  assert.equal(versionMs('2026-11-06T14:20:15.123Z'), expected)
})

test('reads an offset other than UTC', () => {
  assert.equal(versionMs('2026-11-06 09:20:15.123-05'), expected)
})

test('reads an offset with minutes', () => {
  assert.equal(versionMs('2026-11-06 19:50:15.123+05:30'), expected)
})

test('two printings of one version compare equal', () => {
  assert.equal(
    versionMs('2026-11-06 14:20:15.123999+00'),
    versionMs(new Date(expected).toISOString())
  )
})
