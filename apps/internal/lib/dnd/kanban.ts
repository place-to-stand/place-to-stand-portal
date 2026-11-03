import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import { getRankBetween } from '@/lib/rank'

/**
 * Drop-target and rank logic shared by the three kanban boards (project
 * tasks, leads, my tasks). Each board keeps its own state and saving; the
 * edge cases (empty column, dropping on itself, filtered-out cards) are
 * handled here once.
 */

export type KanbanDragEvent = DragOverEvent | DragEndEvent

/** Where a card would land: a column and an index in its rendered list. */
export type KanbanDropTarget<C extends string> = {
  columnId: C
  index: number
}

export type SortableMeta = {
  containerId: string
  index: number
}

/** What `useSortable` puts on a card's drag data, when it is there. */
export function extractSortableMeta(payload: unknown): SortableMeta | null {
  if (!payload || typeof payload !== 'object') return null

  const sortable = (payload as { sortable?: SortableMeta | null }).sortable
  if (!sortable || typeof sortable.index !== 'number') return null

  return { containerId: String(sortable.containerId), index: sortable.index }
}

/** The drag data our cards and columns set: `{ type, columnId }`. */
type KanbanDragData = { type?: string; columnId?: string }

/**
 * Resolves the column and index under the pointer.
 *
 * In order: the sortable card under the pointer (its container and index);
 * a column (its end); a card that names its column (its index there); any
 * card found in a column by id; else the dragged card's own place, so an
 * unrecognised target reads as "no move" rather than a jump.
 *
 * `itemIds(columnId)` lists the ids the column renders, in order;
 * `toColumn` maps a raw column id (a status) onto the board's column type.
 */
export function resolveKanbanDropTarget<C extends string>(
  event: KanbanDragEvent,
  columns: readonly C[],
  itemIds: (columnId: C) => readonly string[],
  toColumn: (id: string) => C = id => id as C
): KanbanDropTarget<C> | null {
  const over = event.over
  if (!over) return null

  const overSortable = extractSortableMeta(over.data?.current)
  if (overSortable) {
    return {
      columnId: toColumn(overSortable.containerId),
      index: overSortable.index,
    }
  }

  const overData = over.data?.current as KanbanDragData | undefined
  const overId = over.id ? over.id.toString() : null

  if (overData?.type === 'column' && overData.columnId) {
    const columnId = toColumn(overData.columnId)
    return { columnId, index: itemIds(columnId).length }
  }

  if (overData?.columnId && overId) {
    const columnId = toColumn(overData.columnId)
    const ids = itemIds(columnId)
    const index = ids.indexOf(overId)
    return { columnId, index: index >= 0 ? index : ids.length }
  }

  if (overId) {
    const columnId = columns.find(column => itemIds(column).includes(overId))
    if (columnId) {
      return { columnId, index: itemIds(columnId).indexOf(overId) }
    }
  }

  const activeSortable = extractSortableMeta(event.active.data?.current)
  if (activeSortable) {
    return {
      columnId: toColumn(activeSortable.containerId),
      index: activeSortable.index,
    }
  }

  return null
}

/** Where `id` sits now, as a drop target (the start of a drag). */
export function locateKanbanItem<C extends string>(
  id: string,
  columns: readonly C[],
  itemIds: (columnId: C) => readonly string[]
): KanbanDropTarget<C> | null {
  for (const columnId of columns) {
    const index = itemIds(columnId).indexOf(id)
    if (index >= 0) return { columnId, index }
  }
  return null
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * The destination column's list after the move: reordered in place for the
 * same column (null when the card would not move), else with `item`
 * inserted at the clamped index.
 */
export function moveIntoColumn<T>(
  destination: readonly T[],
  item: T,
  targetIndex: number,
  sameColumn: { fromIndex: number } | null
): T[] | null {
  if (sameColumn) {
    if (destination.length === 0) return null
    const to = clamp(targetIndex, 0, destination.length - 1)
    if (to === sameColumn.fromIndex) return null
    return arrayMove([...destination], sameColumn.fromIndex, to)
  }
  const at = clamp(targetIndex, 0, destination.length)
  return [...destination.slice(0, at), item, ...destination.slice(at)]
}

/** A rank between the neighbours of `items[index]` (either may be missing). */
export function rankAtIndex(
  items: readonly { rank: string }[],
  index: number
): string {
  return getRankBetween(
    index > 0 ? (items[index - 1]?.rank ?? null) : null,
    items[index + 1]?.rank ?? null
  )
}

/**
 * The rank for the item at `index` of a visible column, placed among the
 * whole column (visible plus filtered-out items, by rank): straight after
 * the visible item above it, or straight before the one below.
 */
export function rankAmongHidden<T extends { rank: string }>(
  visible: readonly T[],
  index: number,
  hidden: readonly T[]
): string {
  if (!hidden.length) return rankAtIndex(visible, index)

  const moved = visible[index]!
  const full = [...visible.filter(item => item !== moved), ...hidden].sort(
    (a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0)
  )
  const above = visible[index - 1]
  const below = visible[index + 1]
  const position = above
    ? full.indexOf(above) + 1
    : below
      ? full.indexOf(below)
      : full.length
  full.splice(position, 0, moved)
  return rankAtIndex(full, position)
}
