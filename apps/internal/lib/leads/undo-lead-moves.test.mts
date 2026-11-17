import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { LeadBoardColumnData } from './types'
import { undoLeadMoves } from './undo-lead-moves'

/** Leads as `id` or `id:rank` (rank defaults to the id). Every board
 * copies its records, as the app's moves do. */
const board = (spec: Record<string, string[]>) =>
  Object.entries(spec).map(([id, leads]) => ({
    id,
    label: id,
    leads: leads.map(lead => {
      const [leadId, rank = leadId] = lead.split(':')
      return { id: leadId, status: id, rank }
    }),
  })) as unknown as LeadBoardColumnData[]

const ids = (columns: LeadBoardColumnData[]) =>
  Object.fromEntries(
    columns.map(column => [column.id, column.leads.map(lead => lead.id)])
  )

test('puts back only the failed lead, keeping a later move', () => {
  const before = board({ NEW: ['a', 'b', 'c'], SENT: [] })
  // a moved to SENT (rank r1, failed), then b moved to SENT (saving).
  const now = board({ NEW: ['c'], SENT: ['b:r2', 'a:r1'] })
  assert.deepEqual(
    ids(undoLeadMoves(now, before, [{ leadId: 'a', rank: 'r1' }], 'SENT')),
    { NEW: ['a', 'c'], SENT: ['b'] }
  )
})

test('returns a lead under its old neighbour', () => {
  const before = board({ NEW: ['a', 'b', 'c'], SENT: [] })
  const now = board({ NEW: ['a', 'c'], SENT: ['b:r1'] })
  assert.deepEqual(
    ids(undoLeadMoves(now, before, [{ leadId: 'b', rank: 'r1' }], 'SENT')).NEW,
    ['a', 'b', 'c']
  )
})

test('puts a group back, each where it was', () => {
  const before = board({ NEW: ['a', 'b', 'c', 'd'], SENT: ['x'] })
  const now = board({ NEW: ['a', 'd'], SENT: ['b:r1', 'c:r2', 'x'] })
  const moved = [
    { leadId: 'b', rank: 'r1' },
    { leadId: 'c', rank: 'r2' },
  ]
  assert.deepEqual(ids(undoLeadMoves(now, before, moved, 'SENT')), {
    NEW: ['a', 'b', 'c', 'd'],
    SENT: ['x'],
  })
})

test('keeps the old record (status and rank) for the lead it puts back', () => {
  const before = board({ NEW: ['a'], SENT: [] })
  const now = board({ NEW: [], SENT: ['a:r1'] })
  const [newColumn] = undoLeadMoves(
    now,
    before,
    [{ leadId: 'a', rank: 'r1' }],
    'SENT'
  )
  assert.equal(newColumn!.leads[0]!.status, 'NEW')
  assert.equal(newColumn!.leads[0]!.rank, 'a')
})

test('leaves a lead that was moved on to another column since', () => {
  const before = board({ NEW: ['a'], SENT: [], ICE: [] })
  const now = board({ NEW: [], SENT: [], ICE: ['a:r2'] })
  assert.deepEqual(
    ids(undoLeadMoves(now, before, [{ leadId: 'a', rank: 'r1' }], 'SENT')),
    { NEW: [], SENT: [], ICE: ['a'] }
  )
})

test('leaves a lead moved again within the same column since', () => {
  const before = board({ NEW: ['a'], SENT: ['x'] })
  // This move put a at r1; a later one (still saving) moved it to r3.
  const now = board({ NEW: [], SENT: ['x', 'a:r3'] })
  assert.deepEqual(
    ids(undoLeadMoves(now, before, [{ leadId: 'a', rank: 'r1' }], 'SENT')),
    { NEW: [], SENT: ['x', 'a'] }
  )
})
