'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type AutoScrollOptions,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'

import type { KanbanDropTarget } from './kanban'
import {
  draftFromColumns,
  locateInDraft,
  moveInDraft,
  settleDraft,
  type KanbanDraft,
} from './kanban-draft'

export type KanbanDrop<C extends string> = {
  id: string
  from: KanbanDropTarget<C>
  to: KanbanDropTarget<C>
  event: DragEndEvent
}

type UseKanbanDragArgs<C extends string, T extends { id: string }> = {
  columns: readonly C[]
  /** Each column's cards as the board renders them when nothing is dragged. */
  items: (columnId: C) => readonly T[]
  onDragStart?: (event: DragStartEvent) => void
  /** Called once on drop, only when the card moved. */
  onDrop: (drop: KanbanDrop<C>) => void
  onDragCancel?: () => void
}

/**
 * Drag and drop for every kanban board (project tasks, my tasks, leads).
 *
 * While a card is dragged it really moves between columns (a draft of the
 * board), so the column under it opens a gap the card's exact height and
 * the other cards slide aside; the dragged card's own slot is the drop
 * placeholder. Boards render `itemsFor(column)` and save in `onDrop`, which
 * gets the final column and index in the rendered list.
 *
 * Collision detection follows dnd-kit's multiple-containers recipe: the
 * card under the pointer wins, a column with cards resolves to its nearest
 * card (so the gaps between cards don't flicker to "end of column"), and
 * the last target holds while a move between columns settles.
 */
export function useKanbanDrag<C extends string, T extends { id: string }>({
  columns,
  items,
  onDragStart,
  onDrop,
  onDragCancel,
}: UseKanbanDragArgs<C, T>) {
  const [draft, setDraftState] = useState<KanbanDraft<C> | null>(null)
  const draftRef = useRef<KanbanDraft<C> | null>(null)
  const originRef = useRef<KanbanDropTarget<C> | null>(null)
  const lastOverId = useRef<UniqueIdentifier | null>(null)
  const movedColumn = useRef(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const setDraft = useCallback((next: KanbanDraft<C> | null) => {
    draftRef.current = next
    setDraftState(next)
  }, [])

  // Let the layout settle for a frame after a move between columns before
  // collision detection trusts the new positions again.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      movedColumn.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [draft])

  const columnSet = useMemo(() => new Set<string>(columns), [columns])

  const byId = useMemo(() => {
    if (!draft) return null
    const map = new Map<string, T>()
    for (const column of columns) {
      for (const item of items(column)) map.set(item.id, item)
    }
    return map
  }, [columns, draft, items])

  const itemsFor = useCallback(
    (columnId: C): readonly T[] => {
      if (!draft || !byId) return items(columnId)
      return (draft.get(columnId) ?? []).flatMap(id => {
        const item = byId.get(id)
        return item ? [item] : []
      })
    },
    [byId, draft, items]
  )

  const reset = useCallback(() => {
    setDraft(null)
    setActiveId(null)
    originRef.current = null
    lastOverId.current = null
    movedColumn.current = false
  }, [setDraft])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id)
      const start = draftFromColumns(columns, column =>
        items(column).map(item => item.id)
      )
      originRef.current = locateInDraft(start, id)
      lastOverId.current = null
      setDraft(start)
      setActiveId(id)
      onDragStart?.(event)
    },
    [columns, items, onDragStart, setDraft]
  )

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      const current = draftRef.current
      if (!current || !over) return

      const id = String(active.id)
      const overId = String(over.id)
      const from = locateInDraft(current, id)
      const overColumn = columnSet.has(overId)
        ? (overId as C)
        : locateInDraft(current, overId)?.columnId
      if (!from || !overColumn || from.columnId === overColumn) return

      // Into another column: above or below the card under it, by which
      // half of that card the dragged card's middle is over.
      const target = current.get(overColumn) ?? []
      const overIndex = target.indexOf(overId)
      let index = target.length
      if (overIndex >= 0) {
        const dragged = active.rect.current.translated
        const below =
          dragged !== null &&
          dragged.top + dragged.height / 2 >
            over.rect.top + over.rect.height / 2
        index = overIndex + (below ? 1 : 0)
      }

      movedColumn.current = true
      setDraft(moveInDraft(current, id, overColumn, index))
    },
    [columnSet, setDraft]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const current = draftRef.current
      const from = originRef.current
      const id = String(event.active.id)
      const to =
        current && event.over
          ? settleDraft(current, id, String(event.over.id))
          : null
      reset()

      if (!from || !to) return
      if (from.columnId === to.columnId && from.index === to.index) return
      onDrop({ id, from, to, event })
    },
    [onDrop, reset]
  )

  const handleDragCancel = useCallback(() => {
    reset()
    onDragCancel?.()
  }, [onDragCancel, reset])

  const collisionDetection = useCallback<CollisionDetection>(
    args => {
      const pointer = pointerWithin(args)
      const hits = pointer.length > 0 ? pointer : rectIntersection(args)
      const card = hits.find(hit => !columnSet.has(String(hit.id)))
      let overId: UniqueIdentifier | null = card?.id ?? hits[0]?.id ?? null

      if (overId !== null) {
        const cardIds = draftRef.current?.get(String(overId) as C)
        if (columnSet.has(String(overId)) && cardIds && cardIds.length > 0) {
          const nearest = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(container =>
              cardIds.includes(String(container.id))
            ),
          })
          overId = nearest[0]?.id ?? overId
        }
        lastOverId.current = overId
        return [{ id: overId }]
      }

      if (movedColumn.current) lastOverId.current = args.active.id
      return lastOverId.current !== null ? [{ id: lastOverId.current }] : []
    },
    [columnSet]
  )

  const activeColumnId = useMemo(
    () =>
      draft && activeId
        ? (locateInDraft(draft, activeId)?.columnId ?? null)
        : null,
    [activeId, draft]
  )

  return {
    activeId,
    /** The column the dragged card sits in now, or null when not dragging. */
    activeColumnId,
    itemsFor,
    dndContextProps: {
      autoScroll: BOARD_AUTO_SCROLL,
      collisionDetection,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
  }
}

/**
 * dnd-kit scrolls once the pointer is in the outer 20% of a scroll area,
 * which on a wide board is most of the last visible column: aiming at it
 * raced the board to its end. Scroll only near the edges, and gently.
 */
const BOARD_AUTO_SCROLL: AutoScrollOptions = {
  threshold: { x: 0.08, y: 0.15 },
  acceleration: 6,
}
