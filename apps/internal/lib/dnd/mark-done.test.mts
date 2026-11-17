import assert from 'node:assert/strict'
import { test } from 'node:test'

import { markDoneMove } from './mark-done'

const board: Record<string, string[]> = {
  ON_DECK: ['a', 'b'],
  IN_PROGRESS: ['c'],
  DONE: ['d'],
}
const placeOf = (id: string) => {
  for (const [columnId, ids] of Object.entries(board)) {
    const index = ids.indexOf(id)
    if (index >= 0) return { columnId, index }
  }
  return null
}

test('one card goes to the top of Done', () => {
  assert.deepEqual(markDoneMove(['b'], placeOf, 'DONE'), {
    id: 'b',
    from: { columnId: 'ON_DECK', index: 1 },
    to: { columnId: 'DONE', index: 0 },
  })
})

test('a card already in Done has nothing to do', () => {
  assert.equal(markDoneMove(['d'], placeOf, 'DONE'), null)
})

test('a selection moves together, leaving cards already done', () => {
  assert.deepEqual(markDoneMove(['a', 'c', 'd'], placeOf, 'DONE'), {
    id: 'a',
    from: { columnId: 'ON_DECK', index: 0 },
    to: { columnId: 'DONE', index: 0 },
    group: ['a', 'c'],
  })
})

test('a selection with one card left to mark moves it alone', () => {
  assert.deepEqual(markDoneMove(['c', 'd'], placeOf, 'DONE')?.group, undefined)
})

test('cards the board no longer holds are skipped', () => {
  assert.equal(markDoneMove(['gone'], placeOf, 'DONE'), null)
})
