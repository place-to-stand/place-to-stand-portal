// Run: npx tsx --test apps/internal/lib/dnd/column-edge-moves.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { columnEdgeMoves } from './column-edge-moves.ts'
import type { KanbanMove } from './use-kanban-drag.ts'

const ids = ['a', 'b', 'c', 'd']

function record() {
  const moves: KanbanMove<'col'>[] = []
  return { moves, onMove: (move: KanbanMove<'col'>) => moves.push(move) }
}

test('a card moves to either end of its column', () => {
  const { moves, onMove } = record()
  const edge = columnEdgeMoves('col', ids, 1, onMove, null)
  edge.toTop?.()
  edge.toBottom?.()
  assert.deepEqual(moves, [
    {
      id: 'b',
      from: { columnId: 'col', index: 1 },
      to: { columnId: 'col', index: 0 },
    },
    {
      id: 'b',
      from: { columnId: 'col', index: 1 },
      to: { columnId: 'col', index: 3 },
    },
  ])
})

test('a card already at an end has that item off', () => {
  const { onMove } = record()
  assert.equal(columnEdgeMoves('col', ids, 0, onMove, null).toTop, null)
  assert.notEqual(columnEdgeMoves('col', ids, 0, onMove, null).toBottom, null)
  assert.equal(columnEdgeMoves('col', ids, 3, onMove, null).toBottom, null)
})

test('a selected group is at an end only when it fills that end', () => {
  const { onMove } = record()
  // Selected a and c: the top holds a, b, so Send to top still gathers them.
  const apart = columnEdgeMoves('col', ids, 2, onMove, ['a', 'c'])
  assert.notEqual(apart.toTop, null)
  assert.notEqual(apart.toBottom, null)
  const top = columnEdgeMoves('col', ids, 1, onMove, ['a', 'b'])
  assert.equal(top.toTop, null)
  assert.notEqual(top.toBottom, null)
  const bottom = columnEdgeMoves('col', ids, 3, onMove, ['c', 'd'])
  assert.equal(bottom.toBottom, null)
  // The toast counts the group.
  assert.equal(bottom.count, 2)
  assert.equal(columnEdgeMoves('col', ids, 1, onMove, null).count, 1)
})
