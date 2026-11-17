import type { KanbanMove } from './use-kanban-drag'

/**
 * Mark as done on a board: the same move as dragging the cards to the top
 * of the Done column. `ids` are the cards to mark, in board order (one
 * card, or the selection). Cards already in Done stay where they are; null
 * when every one of them is there already.
 */
export function markDoneMove<C extends string>(
  ids: readonly string[],
  placeOf: (id: string) => { columnId: C; index: number } | null,
  done: C
): KanbanMove<C> | null {
  const moving = ids.filter(id => {
    const place = placeOf(id)
    return place !== null && place.columnId !== done
  })
  const [id] = moving
  if (!id) return null
  return {
    id,
    from: placeOf(id)!,
    to: { columnId: done, index: 0 },
    ...(moving.length > 1 ? { group: moving } : {}),
  }
}
