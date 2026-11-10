import { arrayMove } from '@dnd-kit/sortable'

import { getRankBetween } from '@/lib/rank'

/**
 * Move and rank logic shared by the three kanban boards (project tasks,
 * leads, my tasks). Each board keeps its own state and saving; the edge
 * cases (empty column, dropping on itself, filtered-out cards) are handled
 * here once. Dragging itself is `useKanbanDrag`.
 */

/**
 * How long a dropped card's preview glides into its slot. The real card stays
 * hidden that long, so anything that styles the card after a drop must wait
 * at least this long (see `useRecentlyMovedItem`).
 */
export const BOARD_DROP_ANIMATION_MS = 120

/** Where a card would land: a column and an index in its rendered list. */
export type KanbanDropTarget<C extends string> = {
  columnId: C
  index: number
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
