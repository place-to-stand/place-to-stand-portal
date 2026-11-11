// Run: npx tsx --test apps/internal/lib/dnd/shown-index.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { shownIndexToBucketIndex } from './shown-index.ts'

const column = ['a', 'h1', 'b', 'h2', 'c'].map(taskId => ({ taskId }))
const hidden = new Set(['h1', 'h2'])

test('nothing hidden: the index is the place', () => {
  assert.equal(shownIndexToBucketIndex(column, new Set(), 2), 2)
  assert.equal(shownIndexToBucketIndex(column, new Set(), 9), 5)
})

test('lands just before the shown card at the index', () => {
  // Shown: a b c. Index 1 = before b, which sits at 2.
  assert.equal(shownIndexToBucketIndex(column, hidden, 0), 0)
  assert.equal(shownIndexToBucketIndex(column, hidden, 1), 2)
  assert.equal(shownIndexToBucketIndex(column, hidden, 2), 4)
})

test('dropped at the end: just after the last shown card', () => {
  assert.equal(shownIndexToBucketIndex(column, hidden, 3), 5)
  const tail = ['a', 'h1'].map(taskId => ({ taskId }))
  assert.equal(shownIndexToBucketIndex(tail, hidden, 1), 1)
})

test('a column with only hidden cards takes the card at the end', () => {
  const onlyHidden = ['h1', 'h2'].map(taskId => ({ taskId }))
  assert.equal(shownIndexToBucketIndex(onlyHidden, hidden, 0), 2)
})
