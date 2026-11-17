import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { LeadBoardColumnData } from './types'
import { undoLeadMoves } from './undo-lead-moves'

const board = (spec: Record<string, string[]>) =>
  Object.entries(spec).map(([id, leads]) => ({
    id,
    label: id,
    leads: leads.map(lead => ({ id: lead, status: id })),
  })) as unknown as LeadBoardColumnData[]

const ids = (columns: LeadBoardColumnData[]) =>
  Object.fromEntries(
    columns.map(column => [column.id, column.leads.map(lead => lead.id)])
  )

test('puts back only the failed lead, keeping a later move', () => {
  const before = board({ NEW: ['a', 'b', 'c'], SENT: [] })
  // a moved to SENT (failed), then b moved to SENT (saving).
  const now = board({ NEW: ['c'], SENT: ['b', 'a'] })
  assert.deepEqual(ids(undoLeadMoves(now, before, ['a'])), {
    NEW: ['a', 'c'],
    SENT: ['b'],
  })
})

test('returns a lead under its old neighbour', () => {
  const before = board({ NEW: ['a', 'b', 'c'], SENT: [] })
  const now = board({ NEW: ['a', 'c'], SENT: ['b'] })
  assert.deepEqual(ids(undoLeadMoves(now, before, ['b'])).NEW, ['a', 'b', 'c'])
})

test('puts a group back, each where it was', () => {
  const before = board({ NEW: ['a', 'b', 'c', 'd'], SENT: ['x'] })
  const now = board({ NEW: ['a', 'd'], SENT: ['b', 'c', 'x'] })
  assert.deepEqual(ids(undoLeadMoves(now, before, ['b', 'c'])), {
    NEW: ['a', 'b', 'c', 'd'],
    SENT: ['x'],
  })
})

test('keeps the old record (status and rank) for the lead it puts back', () => {
  const before = board({ NEW: ['a'], SENT: [] })
  const now = board({ NEW: [], SENT: ['a'] })
  const [newColumn] = undoLeadMoves(now, before, ['a'])
  assert.equal(newColumn!.leads[0]!.status, 'NEW')
})
