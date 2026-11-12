// Run: npx tsx --test apps/internal/lib/projects/task-due-date.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getTaskDueMeta } from './task-due-date.ts'

// 6:34 PM Central on Nov 11: already Nov 12 in UTC, where the server runs.
const evening = new Date('2026-11-12T00:34:00Z')

test('counts days from the company date, whatever the machine zone', () => {
  // The suite runs under whatever TZ the machine has; the labels must not
  // depend on it, or the server render and hydration disagree.
  assert.equal(
    getTaskDueMeta('2026-11-11', { now: evening }).label,
    'Due today'
  )
  assert.equal(
    getTaskDueMeta('2026-11-12', { now: evening }).label,
    'Due tomorrow'
  )
  assert.equal(getTaskDueMeta('2026-11-10', { now: evening }).tone, 'overdue')
  assert.equal(getTaskDueMeta('2026-11-14', { now: evening }).tone, 'caution')
  assert.equal(getTaskDueMeta('2026-11-20', { now: evening }).tone, 'default')
})

test('a done task shows its date only', () => {
  assert.deepEqual(
    getTaskDueMeta('2026-11-11', { status: 'DONE', now: evening }),
    { label: 'Due Nov 11', tone: 'default' }
  )
})
