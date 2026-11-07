// Run: npx tsx --test apps/internal/lib/projects/task-status-stamps.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveTaskStatusStamps } from './task-status-stamps.ts'

const STAMP = '2026-11-01T12:00:00.000Z'

test('entering Done stamps completion and leaves acceptance alone', () => {
  const stamps = resolveTaskStatusStamps('DONE', null)
  assert.ok(stamps.completedAt)
  assert.equal('acceptedAt' in stamps, false)
})

test('staying Done keeps the original completion stamp', () => {
  assert.deepEqual(resolveTaskStatusStamps('DONE', STAMP), {
    completedAt: STAMP,
  })
})

test('reopening clears completion and acceptance', () => {
  for (const status of ['ON_DECK', 'IN_PROGRESS', 'BLOCKED']) {
    assert.deepEqual(resolveTaskStatusStamps(status, STAMP), {
      completedAt: null,
      acceptedAt: null,
    })
  }
})
