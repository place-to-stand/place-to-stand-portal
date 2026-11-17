import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isLatestLeadMove, markLeadMove } from './lead-move-tokens'

test("a later drop of a lead makes the earlier one stale, other leads' don't", () => {
  const board = {}
  const first = markLeadMove(board, ['a'])
  const other = markLeadMove(board, ['b'])
  assert.equal(isLatestLeadMove(board, 'a', first), true)
  const again = markLeadMove(board, ['a', 'c'])
  assert.equal(isLatestLeadMove(board, 'a', first), false)
  assert.equal(isLatestLeadMove(board, 'a', again), true)
  assert.equal(isLatestLeadMove(board, 'c', again), true)
  assert.equal(isLatestLeadMove(board, 'b', other), true)
})

test('boards keep their own moves', () => {
  const one = {}
  const two = {}
  const token = markLeadMove(one, ['a'])
  markLeadMove(two, ['a'])
  assert.equal(isLatestLeadMove(one, 'a', token), true)
})
