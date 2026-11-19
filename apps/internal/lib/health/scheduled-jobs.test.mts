// Run: npx tsx --test apps/internal/lib/health/scheduled-jobs.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { jobState, scheduleIntervalMs } from './scheduled-jobs.ts'

const MIN = 60_000
const now = new Date('2026-11-19T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

test('reads the intervals vercel.json uses', () => {
  assert.equal(scheduleIntervalMs('*/15 * * * *'), 15 * MIN)
  assert.equal(scheduleIntervalMs('30 6 * * *'), 24 * 60 * MIN)
  assert.equal(scheduleIntervalMs('0 7 * * 1'), 7 * 24 * 60 * MIN)
  assert.equal(scheduleIntervalMs('0 7 1 * *'), null)
})

test('a job is late after twice its interval without a run', () => {
  const every15 = '*/15 * * * *'
  assert.equal(
    jobState({ lastRunAt: ago(20 * MIN), lastOutcome: 'ok' }, every15, now),
    'ok'
  )
  assert.equal(
    jobState({ lastRunAt: ago(31 * MIN), lastOutcome: 'ok' }, every15, now),
    'late'
  )
})

test('a failed last run wins; no runs is its own state', () => {
  assert.equal(
    jobState({ lastRunAt: ago(MIN), lastOutcome: 'failed' }, '0 7 * * 1', now),
    'failed'
  )
  assert.equal(
    jobState({ lastRunAt: null, lastOutcome: null }, '0 7 * * 1', now),
    'unrecorded'
  )
})
