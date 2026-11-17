import type { KanbanMove } from './use-kanban-drag'

/**
 * Send to top / bottom for the card at `index` of a column (`ids`, in board
 * order): the same move as dragging it to that end of the column. Null where
 * the card already sits there, or for a selected card (`group`, from
 * `columnGroup`), where the column's selected cards already sit together
 * there.
 */
export function columnEdgeMoves<C extends string>(
  columnId: C,
  ids: readonly string[],
  index: number,
  onMove: (move: KanbanMove<C>) => void,
  group: readonly string[] | null
): {
  toTop: (() => void) | null
  toBottom: (() => void) | null
  /** How many cards a send moves (the group, or the one card). */
  count: number
} {
  const id = ids[index]!
  const last = ids.length - 1
  const moveTo = (to: number) => () =>
    onMove({
      id,
      from: { columnId, index },
      to: { columnId, index: to },
    })
  const sitsAt = (end: readonly string[]) =>
    group ? end.join() === group.join() : true
  const atTop = group ? sitsAt(ids.slice(0, group.length)) : index === 0
  const atBottom = group
    ? sitsAt(ids.slice(ids.length - group.length))
    : index === last
  return {
    toTop: atTop ? null : moveTo(0),
    toBottom: atBottom ? null : moveTo(last),
    count: group?.length ?? 1,
  }
}
