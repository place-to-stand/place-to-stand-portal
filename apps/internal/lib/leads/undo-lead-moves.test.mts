import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { LeadBoardColumnData } from './types'
import { undoLeadMoves } from './undo-lead-moves'

type Lead = LeadBoardColumnData['leads'][number]

/** One record per lead id, so boards can share them as the app's do. */
const records = new Map<string, Lead>()
const record = (id: string, status: string) => {
  const key = `${id}@${status}`
  if (!records.has(key)) records.set(key, { id, status } as unknown as Lead)
  return records.get(key)!
}

const board = (spec: Record<string, string[]>) =>
  Object.entries(spec).map(([id, leads]) => ({
    id,
    label: id,
    leads: leads.map(lead => record(lead, id)),
  })) as unknown as LeadBoardColumnData[]

const ids = (columns: LeadBoardColumnData[]) =>
  Object.fromEntries(
    columns.map(column => [column.id, column.leads.map(lead => lead.id)])
  )

test('puts back only the failed lead, keeping a later move', () => {
  const before = board({ NEW: ['a', 'b', 'c'], SENT: [] })
  // a moved to SENT (failed), then b moved to SENT (saving).
  const after = board({ NEW: ['b', 'c'], SENT: ['a'] })
  const now = board({ NEW: ['c'], SENT: ['b', 'a'] })
  assert.deepEqual(ids(undoLeadMoves(now, before, after, ['a'])), {
    NEW: ['a', 'c'],
    SENT: ['b'],
  })
})

test('returns a lead under its old neighbour', () => {
  const before = board({ NEW: ['a', 'b', 'c'], SENT: [] })
  const now = board({ NEW: ['a', 'c'], SENT: ['b'] })
  assert.deepEqual(ids(undoLeadMoves(now, before, now, ['b'])).NEW, [
    'a',
    'b',
    'c',
  ])
})

test('puts a group back, each where it was', () => {
  const before = board({ NEW: ['a', 'b', 'c', 'd'], SENT: ['x'] })
  const now = board({ NEW: ['a', 'd'], SENT: ['b', 'c', 'x'] })
  assert.deepEqual(ids(undoLeadMoves(now, before, now, ['b', 'c'])), {
    NEW: ['a', 'b', 'c', 'd'],
    SENT: ['x'],
  })
})

test('keeps the old record (status and rank) for the lead it puts back', () => {
  const before = board({ NEW: ['a'], SENT: [] })
  const now = board({ NEW: [], SENT: ['a'] })
  const [newColumn] = undoLeadMoves(now, before, now, ['a'])
  assert.equal(newColumn!.leads[0]!.status, 'NEW')
})

test('leaves a lead that was moved again since', () => {
  const before = board({ NEW: ['a'], SENT: [], ICE: [] })
  const after = board({ NEW: [], SENT: ['a'], ICE: [] })
  // a went to SENT (this move, failed), then on to ICE (saving).
  const now = board({ NEW: [], SENT: [], ICE: ['a'] })
  assert.deepEqual(ids(undoLeadMoves(now, before, after, ['a'])), {
    NEW: [],
    SENT: [],
    ICE: ['a'],
  })
})

test('leaves a lead moved again within the same column, or back to the same spot', () => {
  const before = board({ NEW: ['a'], SENT: ['x'] })
  const after = board({ NEW: [], SENT: ['a', 'x'] })
  // A later move placed a new record for a in SENT (its save is still out).
  const now = after.map(column => ({
    ...column,
    leads: column.leads.map(lead => (lead.id === 'a' ? { ...lead } : lead)),
  }))
  assert.deepEqual(ids(undoLeadMoves(now, before, after, ['a'])), {
    NEW: [],
    SENT: ['a', 'x'],
  })
})

test('leaves the board alone once a server refresh replaced the records', () => {
  const before = board({ NEW: ['a'], SENT: [] })
  const after = board({ NEW: [], SENT: ['a'] })
  const refreshed = structuredClone(before)
  assert.deepEqual(ids(undoLeadMoves(refreshed, before, after, ['a'])), {
    NEW: ['a'],
    SENT: [],
  })
})
