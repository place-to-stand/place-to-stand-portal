// Run: npx tsx --test apps/internal/lib/dnd/board-selection.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  boardRange,
  hasSelectModifier,
  idsToPutBack,
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
  assert.equal(hasSelectModifier(plain), false)
  assert.equal(hasSelectModifier({ ...plain, shiftKey: true }), true)
  assert.equal(hasSelectModifier({ ...plain, metaKey: true }), true)
  assert.equal(hasSelectModifier({ ...plain, ctrlKey: true }), true)
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
