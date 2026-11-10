// Run: npx tsx --test apps/internal/lib/dnd/kanban.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { moveIntoColumn, rankAmongHidden, rankAtIndex } from './kanban.ts'

test('moveIntoColumn: same column reorders, self-drop is no move', () => {
  assert.deepEqual(moveIntoColumn(['a', 'b', 'c'], 'a', 2, { fromIndex: 0 }), [
    'b',
    'c',
    'a',
  ])
  // Past the end of its own column clamps to the last place.
  assert.deepEqual(moveIntoColumn(['a', 'b', 'c'], 'a', 9, { fromIndex: 0 }), [
    'b',
    'c',
    'a',
  ])
  assert.equal(moveIntoColumn(['a', 'b'], 'b', 1, { fromIndex: 1 }), null)
  assert.deepEqual(moveIntoColumn([], 'x', 5, null), ['x'])
  assert.deepEqual(moveIntoColumn(['a', 'b'], 'x', 1, null), ['a', 'x', 'b'])
})

test('ranks sit between neighbours, hidden cards included', () => {
  const r = (rank: string) => ({ rank })
  const between = rankAtIndex([r('b'), r('x'), r('d')], 1)
  assert.ok(between > 'b' && between < 'd')
  assert.ok(rankAtIndex([r('m')], 0).length > 0)

  // Visible: a, [moved], e. Hidden c sits between a and e; the moved card
  // goes straight after a, so before c.
  const moved = r('z')
  const rank = rankAmongHidden([r('a'), moved, r('e')], 1, [r('c')])
  assert.ok(rank > 'a' && rank < 'c', rank)
})
