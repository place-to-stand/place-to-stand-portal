// Run: npx tsx --test apps/internal/lib/table/sort-rows.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sortRows } from './sort-rows.ts'

const rows = [
  { id: 'a', name: 'beta', n: 2 },
  { id: 'b', name: null, n: null },
  { id: 'c', name: 'Alpha', n: 10 },
  { id: 'd', name: 'alpha', n: 2 },
]

test('sorts strings A-Z in any case, empty values last', () => {
  assert.deepEqual(
    sortRows(rows, row => row.name, 'asc').map(row => row.id),
    ['c', 'd', 'a', 'b']
  )
})

test('descending keeps empty values last and ties in arrival order', () => {
  assert.deepEqual(
    sortRows(rows, row => row.name, 'desc').map(row => row.id),
    ['a', 'c', 'd', 'b']
  )
  assert.deepEqual(
    sortRows(rows, row => row.n, 'desc').map(row => row.id),
    ['c', 'a', 'd', 'b']
  )
})

test('numbers compare as numbers', () => {
  assert.deepEqual(
    sortRows(rows, row => row.n, 'asc').map(row => row.id),
    ['a', 'd', 'c', 'b']
  )
})

test('blank strings and NaN count as no value', () => {
  const blanks = [
    { id: 'a', v: '  ' },
    { id: 'b', v: 'x' },
    { id: 'c', v: Number.NaN },
    { id: 'd', v: 'a' },
  ]
  assert.deepEqual(
    sortRows(blanks, row => row.v, 'asc').map(row => row.id),
    ['d', 'b', 'a', 'c']
  )
})
