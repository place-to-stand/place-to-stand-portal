// Run: npx tsx --test apps/internal/lib/dnd/board-selection.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  boardRange,
  dropAmongHidden,
  hasSelectModifier,
  idsToPutBack,
  taskGroup,
  withoutHidden,
} from './board-selection.ts'

const columns = [
  ['a1', 'a2', 'a3', 'a4'],
  ['b1', 'b2'],
]

test('a range runs down one column, either way', () => {
  assert.deepEqual(boardRange(columns, 'a2', 'a4'), ['a2', 'a3', 'a4'])
  assert.deepEqual(boardRange(columns, 'a4', 'a2'), ['a2', 'a3', 'a4'])
  assert.deepEqual(boardRange(columns, 'b1', 'b1'), ['b1'])
})

test('no range across columns or for a card off the board', () => {
  assert.equal(boardRange(columns, 'a1', 'b2'), null)
  assert.equal(boardRange(columns, 'gone', 'a2'), null)
})

test('Shift, ⌘ or Ctrl select; a plain click opens', () => {
  const plain = { shiftKey: false, metaKey: false, ctrlKey: false }
  assert.equal(hasSelectModifier(plain, false), false)
  assert.equal(hasSelectModifier({ ...plain, shiftKey: true }, true), true)
  assert.equal(hasSelectModifier({ ...plain, metaKey: true }, true), true)
  assert.equal(hasSelectModifier({ ...plain, ctrlKey: true }, false), true)
})

test('on a Mac, Ctrl-click is left to the right-click menu', () => {
  const ctrl = { shiftKey: false, metaKey: false, ctrlKey: true }
  assert.equal(hasSelectModifier(ctrl, true), false)
})

test('hidden cards leave the column, the rest keep their order', () => {
  const items = [{ id: 'x' }, { id: 'y' }, { id: 'z' }]
  assert.equal(withoutHidden(items, new Set()), items)
  assert.deepEqual(withoutHidden(items, new Set(['y'])), [
    { id: 'x' },
    { id: 'z' },
  ])
})

test('refused cards go back; a failed call puts back every card', () => {
  const ids = ['x', 'y', 'z']
  assert.deepEqual(idsToPutBack(ids, { failed: [] }), [])
  assert.deepEqual(
    idsToPutBack(ids, { failed: [{ id: 'y' }, { id: 'other' }] }),
    ['y']
  )
  assert.deepEqual(idsToPutBack(ids, { failed: [], error: 'Timed out' }), ids)
})

test('a task is grouped by its project, else its lead', () => {
  assert.equal(taskGroup({ project_id: 'p', lead_id: null }), 'project:p')
  assert.equal(taskGroup({ project_id: null, lead_id: 'l' }), 'lead:l')
  assert.equal(taskGroup(undefined), 'unknown')
})

test('a drop past a hidden card lands between the cards it was dropped between', () => {
  const cards: Record<string, string[]> = {
    a: ['a1', 'h1', 'a2', 'a3'],
    b: ['b1', 'h2', 'b2'],
  }
  const cardsIn = (column: string) => cards[column]
  const hidden = new Set(['h1', 'h2'])
  // Shown a: a1 a2 a3. a3 dropped between a1 and a2 (shown index 1).
  assert.deepEqual(
    dropAmongHidden(
      {
        id: 'a3',
        from: { columnId: 'a', index: 2 },
        to: { columnId: 'a', index: 1 },
      },
      cardsIn,
      hidden
    ),
    {
      id: 'a3',
      from: { columnId: 'a', index: 3 },
      to: { columnId: 'a', index: 2 },
    }
  )
  // Into b, between b1 and b2 (shown index 1): just before b2.
  assert.deepEqual(
    dropAmongHidden(
      {
        id: 'a1',
        from: { columnId: 'a', index: 0 },
        to: { columnId: 'b', index: 1 },
      },
      cardsIn,
      hidden
    ).to,
    { columnId: 'b', index: 2 }
  )
  // At the end of b: after the last shown card.
  assert.deepEqual(
    dropAmongHidden(
      {
        id: 'a1',
        from: { columnId: 'a', index: 0 },
        to: { columnId: 'b', index: 2 },
      },
      cardsIn,
      hidden
    ).to,
    { columnId: 'b', index: 3 }
  )
  // Nothing hidden: unchanged.
  const move = {
    id: 'a1',
    from: { columnId: 'a', index: 0 },
    to: { columnId: 'b', index: 1 },
  }
  assert.equal(dropAmongHidden(move, cardsIn, new Set()), move)
})
