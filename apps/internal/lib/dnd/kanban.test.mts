// Run: npx tsx --test apps/internal/lib/dnd/kanban.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  locateKanbanItem,
  moveIntoColumn,
  rankAmongHidden,
  rankAtIndex,
  resolveKanbanDropTarget,
  type KanbanDragEvent,
} from './kanban.ts'

const columns = ['todo', 'done'] as const
type Col = (typeof columns)[number]
const board: Record<Col, string[]> = { todo: ['a', 'b', 'c'], done: [] }
const ids = (column: Col) => board[column]

const event = (
  over: { id: string; data?: unknown } | null,
  active: unknown = { sortable: { containerId: 'todo', index: 0 } }
) =>
  ({
    active: { id: 'a', data: { current: active } },
    over: over && { id: over.id, data: { current: over.data } },
  }) as unknown as KanbanDragEvent

test('drop target: sortable card, column, named card, bare id, fallback', () => {
  assert.equal(resolveKanbanDropTarget(event(null), columns, ids), null)
  assert.deepEqual(
    resolveKanbanDropTarget(
      event({ id: 'c', data: { sortable: { containerId: 'todo', index: 2 } } }),
      columns,
      ids
    ),
    { columnId: 'todo', index: 2 }
  )
  // An empty column takes the card at its end (index 0).
  assert.deepEqual(
    resolveKanbanDropTarget(
      event({ id: 'done', data: { type: 'column', columnId: 'done' } }),
      columns,
      ids
    ),
    { columnId: 'done', index: 0 }
  )
  assert.deepEqual(
    resolveKanbanDropTarget(
      event({ id: 'b', data: { type: 'lead', columnId: 'todo' } }),
      columns,
      ids
    ),
    { columnId: 'todo', index: 1 }
  )
  assert.deepEqual(resolveKanbanDropTarget(event({ id: 'c' }), columns, ids), {
    columnId: 'todo',
    index: 2,
  })
  // Unknown target: stays where it was.
  assert.deepEqual(
    resolveKanbanDropTarget(event({ id: 'zzz' }), columns, ids),
    { columnId: 'todo', index: 0 }
  )
  assert.deepEqual(locateKanbanItem('b', columns, ids), {
    columnId: 'todo',
    index: 1,
  })
})

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
