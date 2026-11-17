import type { LeadBoardColumnData, LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { moveIntoColumn, rankAmongHidden } from '@/lib/dnd/kanban'
import { ranksForBlock } from '@/lib/dnd/kanban-group'

/** Lead board drag state: the reordered columns after a drop. */

export function cloneColumns(
  columns: LeadBoardColumnData[]
): LeadBoardColumnData[] {
  return columns.map(column => ({
    ...column,
    leads: column.leads.map(lead => ({ ...lead })),
  }))
}

export function findLeadById(
  columns: LeadBoardColumnData[],
  leadId: string
): LeadRecord | null {
  for (const column of columns) {
    const lead = column.leads.find(item => item.id === leadId)
    if (lead) {
      return lead
    }
  }

  return null
}

export function produceLeadReorder({
  columns,
  leadId,
  targetColumnId,
  targetIndex,
  hiddenLeads,
}: {
  columns: LeadBoardColumnData[]
  leadId: string
  targetColumnId: LeadStatusValue
  targetIndex: number
  hiddenLeads: LeadRecord[]
}): {
  nextColumns: LeadBoardColumnData[]
  previousColumns: LeadBoardColumnData[]
  rank: string
  targetColumnId: LeadStatusValue
} | null {
  const previousColumns = cloneColumns(columns)
  const nextColumns = cloneColumns(columns)

  const sourceColumn = nextColumns.find(column =>
    column.leads.some(lead => lead.id === leadId)
  )
  const targetColumn = nextColumns.find(column => column.id === targetColumnId)

  if (!sourceColumn || !targetColumn) {
    return null
  }

  const sourceIndex = sourceColumn.leads.findIndex(lead => lead.id === leadId)
  const moved = sourceColumn.leads[sourceIndex]
  if (!moved) {
    return null
  }

  const isSameColumn = sourceColumn.id === targetColumnId
  const reorderedLeads = moveIntoColumn(
    targetColumn.leads,
    moved,
    targetIndex,
    isSameColumn ? { fromIndex: sourceIndex } : null
  )
  if (!reorderedLeads) {
    return null
  }

  if (!isSameColumn) {
    sourceColumn.leads.splice(sourceIndex, 1)
  }

  const insertedIndex = reorderedLeads.indexOf(moved)
  const rank = rankAmongHidden(
    reorderedLeads,
    insertedIndex,
    hiddenLeads.filter(lead => lead.status === targetColumnId)
  )

  reorderedLeads[insertedIndex] = { ...moved, status: targetColumnId, rank }
  targetColumn.leads = reorderedLeads

  if (moved.status === targetColumnId && moved.rank === rank) {
    return null
  }

  return {
    nextColumns,
    previousColumns,
    rank,
    targetColumnId,
  }
}

/**
 * Several selected leads dropped together: they leave their columns and
 * land as one block at `targetIndex` of the target column (counted without
 * them), in the group's order, ranked between the leads they land between.
 */
export function produceLeadGroupMove({
  columns,
  group,
  targetColumnId,
  targetIndex,
  hiddenLeads,
}: {
  columns: LeadBoardColumnData[]
  group: readonly string[]
  targetColumnId: LeadStatusValue
  targetIndex: number
  hiddenLeads: LeadRecord[]
}): {
  nextColumns: LeadBoardColumnData[]
  previousColumns: LeadBoardColumnData[]
  moved: { lead: LeadRecord; rank: string }[]
} | null {
  const previousColumns = cloneColumns(columns)
  const nextColumns = cloneColumns(columns)
  const moving = new Set(group)
  const leads = group.flatMap(id => {
    const lead = findLeadById(nextColumns, id)
    return lead ? [lead] : []
  })
  const targetColumn = nextColumns.find(column => column.id === targetColumnId)
  if (!targetColumn || leads.length !== group.length) return null

  for (const column of nextColumns) {
    column.leads = column.leads.filter(lead => !moving.has(lead.id))
  }
  const ranks = ranksForBlock(
    targetColumn.leads,
    targetIndex,
    hiddenLeads.filter(
      lead => lead.status === targetColumnId && !moving.has(lead.id)
    ),
    leads.length
  )
  const placed = leads.map((lead, index) => ({
    ...lead,
    status: targetColumnId,
    rank: ranks[index]!,
  }))
  const at = Math.min(Math.max(targetIndex, 0), targetColumn.leads.length)
  targetColumn.leads.splice(at, 0, ...placed)

  return {
    nextColumns,
    previousColumns,
    moved: leads.map((lead, index) => ({ lead, rank: ranks[index]! })),
  }
}
