// Run: npx tsx --test apps/internal/lib/dnd/kanban-draft.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  draftFromColumns,
  locateInDraft,
  moveInDraft,
  settleDraft,
} from './kanban-draft.ts'

const board = { todo: ['a', 'b', 'c'], done: ['d'] } as const
type Col = keyof typeof board
const draft = () =>
  draftFromColumns<Col>(['todo', 'done'], column => board[column])
const asObject = (value: ReturnType<typeof draft>) => Object.fromEntries(value)

test('locate: column and index, or null', () => {
  assert.deepEqual(locateInDraft(draft(), 'c'), { columnId: 'todo', index: 2 })
  assert.equal(locateInDraft(draft(), 'x'), null)
})

test('move: into another column at an index, clamped', () => {
  assert.deepEqual(asObject(moveInDraft(draft(), 'b', 'done', 0)), {
    todo: ['a', 'c'],
    done: ['b', 'd'],
  })
  assert.deepEqual(asObject(moveInDraft(draft(), 'b', 'done', 9)), {
    todo: ['a', 'c'],
    done: ['d', 'b'],
  })
  // Moving into an empty column.
  const emptied = moveInDraft(draft(), 'd', 'todo', 0)
  assert.deepEqual(asObject(moveInDraft(emptied, 'a', 'done', 0)), {
    todo: ['d', 'b', 'c'],
    done: ['a'],
  })
})

test('settle: same column takes the place of the card dropped on', () => {
  assert.deepEqual(settleDraft(draft(), 'a', 'c'), {
    columnId: 'todo',
    index: 2,
  })
  assert.deepEqual(settleDraft(draft(), 'c', 'a'), {
    columnId: 'todo',
    index: 0,
  })
  // Dropped on itself, on its column or on a card elsewhere: stays put.
  assert.deepEqual(settleDraft(draft(), 'b', 'b'), {
    columnId: 'todo',
    index: 1,
  })
  assert.deepEqual(settleDraft(draft(), 'b', 'todo'), {
    columnId: 'todo',
    index: 1,
  })
  assert.deepEqual(settleDraft(draft(), 'b', 'd'), {
    columnId: 'todo',
    index: 1,
  })
  assert.equal(settleDraft(draft(), 'x', 'a'), null)
})
