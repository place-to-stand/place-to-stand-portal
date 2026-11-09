import { arrayMove } from '@dnd-kit/sortable'

import { clamp, type KanbanDropTarget } from './kanban'

/**
 * The board as it looks mid-drag: each column's card ids in order. A card
 * dragged into another column moves here at once, so that column opens a
 * gap for it (dnd-kit's sortable animation) instead of a placeholder
 * popping in. Pure, so the boards' drag hook and its tests share it.
 */
export type KanbanDraft<C extends string> = ReadonlyMap<C, readonly string[]>

export function draftFromColumns<C extends string>(
  columns: readonly C[],
  itemIds: (columnId: C) => readonly string[]
): KanbanDraft<C> {
  return new Map(columns.map(column => [column, [...itemIds(column)]]))
}

/** Where `id` sits in the draft, or null. */
export function locateInDraft<C extends string>(
  draft: KanbanDraft<C>,
  id: string
): KanbanDropTarget<C> | null {
  for (const [columnId, ids] of draft) {
    const index = ids.indexOf(id)
    if (index >= 0) return { columnId, index }
  }
  return null
}

/** The draft with `id` taken out of its column and put in `to` at `index`. */
export function moveInDraft<C extends string>(
  draft: KanbanDraft<C>,
  id: string,
  to: C,
  index: number
): KanbanDraft<C> {
  const next = new Map<C, readonly string[]>()
  for (const [columnId, ids] of draft) {
    next.set(
      columnId,
      ids.filter(item => item !== id)
    )
  }
  const target = [...(next.get(to) ?? [])]
  target.splice(clamp(index, 0, target.length), 0, id)
  next.set(to, target)
  return next
}

/**
 * Where the dragged card lands on drop. A move inside one column is only
 * shown by dnd-kit's transforms while dragging, so it is applied here: the
 * card takes the place of the card it was dropped on.
 */
export function settleDraft<C extends string>(
  draft: KanbanDraft<C>,
  activeId: string,
  overId: string | null
): KanbanDropTarget<C> | null {
  const from = locateInDraft(draft, activeId)
  if (!from) return null

  const ids = draft.get(from.columnId) ?? []
  const overIndex = overId ? ids.indexOf(overId) : -1
  if (overIndex < 0 || overIndex === from.index) return from

  const settled = arrayMove([...ids], from.index, overIndex)
  return { columnId: from.columnId, index: settled.indexOf(activeId) }
}
