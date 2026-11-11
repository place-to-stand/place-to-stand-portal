// Run: npx tsx --test apps/internal/lib/search/text-match.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { matchesSearch } from './text-match.ts'

test('an empty query matches everything', () => {
  assert.equal(matchesSearch(['Anything'], ''), true)
  assert.equal(matchesSearch([], '   '), true)
  assert.equal(matchesSearch(['Anything'], undefined), true)
})

test('matches any field, ignoring case', () => {
  const fields = ['Jo Smith', 'Under Pressure Screen Printing', null]
  assert.equal(matchesSearch(fields, 'under'), true)
  assert.equal(matchesSearch(fields, 'SMITH'), true)
  assert.equal(matchesSearch(fields, 'acme'), false)
})

test('every word must appear, in any order, across fields', () => {
  const fields = ['Jo Smith', 'Under Pressure Screen Printing']
  assert.equal(matchesSearch(fields, 'printing jo'), true)
  assert.equal(matchesSearch(fields, 'printing acme'), false)
})
