import { getRankBetween } from '@/lib/rank'

import type { BoardColumns } from './board-selection'
import { clamp } from './kanban'

/**
 * Moving several selected cards at once. A drag or a Send to top / bottom
 * of a selected card takes every selected card along (a drag: from any
 * column; Send to top / bottom: from the card's own column), and they land
 * together, in board order, where the one card was put.
 */

/** The selected cards in board order: column by column, top to bottom. */
function selectedInOrder(
  columns: BoardColumns,
  selected: ReadonlySet<string>
): string[] {
  return columns.flat().filter(id => selected.has(id))
}

/**
 * The cards a drag of `id` moves: every selected card, when `id` is one of
 * two or more. Null for a single card.
 */
export function dragGroup(
  columns: BoardColumns,
  selected: ReadonlySet<string>,
  id: string
): string[] | null {
  if (!selected.has(id) || selected.size < 2) return null
  const group = selectedInOrder(columns, selected)
  return group.length > 1 ? group : null
}

/**
 * The cards a Send to top / bottom of `id` moves: the selected cards in its
 * own column, when `id` is one of two or more there. Null otherwise.
 */
export function columnGroup(
  columns: BoardColumns,
  selected: ReadonlySet<string>,
  id: string
): string[] | null {
  if (!selected.has(id)) return null
  const column = columns.find(ids => ids.includes(id)) ?? []
  const group = column.filter(cardId => selected.has(cardId))
  return group.length > 1 ? group : null
}

/**
 * Ranks for `count` cards landing together at `index` of a column's shown
 * cards (`visible`, without the moving cards), placed among the whole
 * column (`hidden` holds the cards a filter hides): straight after the
 * shown card above, or straight before the one below, in order.
 */
export function ranksForBlock<T extends { rank: string }>(
  visible: readonly T[],
  index: number,
  hidden: readonly T[],
  count: number
): string[] {
  const full = hidden.length
    ? [...visible, ...hidden].sort((a, b) =>
        a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0
      )
    : [...visible]
  const at = clamp(index, 0, visible.length)
  const above = visible[at - 1]
  const below = visible[at]
  const position = above
    ? full.indexOf(above) + 1
    : below
      ? full.indexOf(below)
      : full.length
  const next = full[position]?.rank ?? null
  let previous = full[position - 1]?.rank ?? null
  const ranks: string[] = []
  for (let n = 0; n < count; n++) {
    previous = getRankBetween(previous, next)
    ranks.push(previous)
  }
  return ranks
}
