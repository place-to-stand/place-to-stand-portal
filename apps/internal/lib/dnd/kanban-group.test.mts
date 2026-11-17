// Run: npx tsx --test apps/internal/lib/dnd/kanban-group.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { columnGroup, dragGroup, ranksForBlock } from './kanban-group.ts'

const columns = [
  ['a1', 'a2', 'a3'],
  ['b1', 'b2'],
]

test('a drag takes every selected card, in board order', () => {
  const selected = new Set(['b2', 'a3', 'a1'])
  assert.deepEqual(dragGroup(columns, selected, 'b2'), ['a1', 'a3', 'b2'])
  // A card outside the selection, or a lone selected card, moves alone.
  assert.equal(dragGroup(columns, selected, 'a2'), null)
  assert.equal(dragGroup(columns, new Set(['a1']), 'a1'), null)
})

test('Send to top / bottom takes the selected cards in its column only', () => {
  const selected = new Set(['a1', 'a3', 'b2'])
  assert.deepEqual(columnGroup(columns, selected, 'a3'), ['a1', 'a3'])
  assert.equal(columnGroup(columns, selected, 'b2'), null)
})

const r = (rank: string) => ({ rank })

test('a block ranks in order between the cards it lands between', () => {
  const ranks = ranksForBlock([r('a'), r('e')], 1, [], 3)
  assert.equal(ranks.length, 3)
  assert.ok('a' < ranks[0] && ranks[0] < ranks[1] && ranks[1] < ranks[2])
  assert.ok(ranks[2] < 'e')
})

test('a block at either end of a column, or an empty one', () => {
  const top = ranksForBlock([r('m')], 0, [], 2)
  assert.ok(top[0] < top[1] && top[1] < 'm')
  const bottom = ranksForBlock([r('m')], 1, [], 2)
  assert.ok('m' < bottom[0] && bottom[0] < bottom[1])
  const empty = ranksForBlock([], 0, [], 2)
  assert.ok(empty[0] < empty[1])
})

test('a block lands straight after the shown card above, past hidden ones', () => {
  // Shown a, e; hidden c sits between them. Dropped below a: before c.
  const ranks = ranksForBlock([r('a'), r('e')], 1, [r('c')], 2)
  assert.ok('a' < ranks[0] && ranks[1] < 'c')
})
