import type { LeadBoardColumnData, LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'
import {
  locateKanbanItem,
  moveIntoColumn,
  rankAmongHidden,
  resolveKanbanDropTarget,
  type KanbanDragEvent,
  type KanbanDropTarget,
} from '@/lib/dnd/kanban'

/** Lead board drag state: where a lead would land, and the reordered columns. */

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

export const LEAD_COLUMN_IDS = (columns: LeadBoardColumnData[]) =>
  columns.map(column => column.id)

export const leadIdsIn =
  (columns: LeadBoardColumnData[]) => (columnId: LeadStatusValue) =>
    columns
      .find(column => column.id === columnId)
      ?.leads.map(lead => lead.id) ?? []

export function resolveCurrentLocation(
  leadId: string,
  columns: LeadBoardColumnData[]
): DropTarget | null {
  return locateKanbanItem(leadId, LEAD_COLUMN_IDS(columns), leadIdsIn(columns))
}

export type DropTarget = KanbanDropTarget<LeadStatusValue>

export function resolveDropTarget(
  event: KanbanDragEvent,
  columns: LeadBoardColumnData[]
): DropTarget | null {
  return resolveKanbanDropTarget(
    event,
    LEAD_COLUMN_IDS(columns),
    leadIdsIn(columns)
  )
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
