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
  gatherGroup,
  measureBoardCards,
  settleGroupDrop,
} from './settle-group-drop'
import {
  draftFromColumns,
  locateInDraft,
  moveInDraft,
  settleDraft,
  type KanbanDraft,
} from './kanban-draft'

/**
 * A card moving from one place to another. A drop is one; so is the card
 * menu's "Send to top" / "Send to bottom", which boards save the same way.
 */
export type KanbanMove<C extends string> = {
  id: string
  from: KanbanDropTarget<C>
  to: KanbanDropTarget<C>
  /**
   * Several selected cards moving together, in board order (`id` among
   * them). They land as one block at `to`, whose index then counts the
   * column's cards without any of the group.
   */
  group?: readonly string[]
}

export type KanbanDrop<C extends string> = KanbanMove<C> & {
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
  /**
   * The cards a drag of `id` takes along (`id` included, in board order),
   * or null for the card alone: the board's selection.
   */
  groupOf?: (id: string) => readonly string[] | null
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
  groupOf,
}: UseKanbanDragArgs<C, T>) {
  const [draft, setDraftState] = useState<KanbanDraft<C> | null>(null)
  const draftRef = useRef<KanbanDraft<C> | null>(null)
  const originRef = useRef<KanbanDropTarget<C> | null>(null)
  const lastOverId = useRef<UniqueIdentifier | null>(null)
  const movedColumn = useRef(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [group, setGroup] = useState<readonly string[] | null>(null)
  const groupFrame = useRef<number | null>(null)
  const gathering = useRef<(() => void) | null>(null)

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
    if (groupFrame.current !== null) {
      cancelAnimationFrame(groupFrame.current)
      groupFrame.current = null
    }
    gathering.current?.()
    gathering.current = null
    setDraft(null)
    setActiveId(null)
    setGroup(null)
    originRef.current = null
    lastOverId.current = null
    movedColumn.current = false
  }, [setDraft])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id)
      // The other cards of a group leave the board while it moves, and
      // drop in after the dragged one.
      const moving = groupOf?.(id) ?? null
      const along = new Set(moving?.filter(other => other !== id))
      const all = draftFromColumns(columns, column =>
        items(column).map(item => item.id)
      )
      const withoutAlong = (draft: KanbanDraft<C>) =>
        along.size ? removeFromDraft(draft, along) : draft
      originRef.current = locateInDraft(withoutAlong(all), id)
      lastOverId.current = null
      setDraft(all)
      setActiveId(id)
      setGroup(moving)
      onDragStart?.(event)
      if (!along.size) return

      // The rest of the group leaves the board only once dnd-kit has
      // measured the grabbed card, so the stack starts under the pointer
      // rather than where the card slides to. The drop slot stays one card
      // tall, so the cards around it stay put.
      // Two frames: dnd-kit measures the grabbed card in the frame after
      // the drag starts, and one frame was too soon (the stack started where
      // the card slid to).
      groupFrame.current = requestAnimationFrame(() => {
        groupFrame.current = requestAnimationFrame(() => {
          groupFrame.current = null
          const current = draftRef.current
          if (!current || !locateInDraft(current, id)) return
          gathering.current = gatherGroup({ along: [...along] })
          setDraft(withoutAlong(current))
        })
      })
    },
    [columns, groupOf, items, onDragStart, setDraft]
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
      const moving = group
      // A drop before the group left the draft (a flick within one frame)
      // still counts the column without it, and never lands on its own card.
      const along = new Set(moving?.filter(other => other !== id))
      const draft =
        current && along.size ? removeFromDraft(current, along) : current
      const overId = event.over ? String(event.over.id) : null
      const to =
        draft && overId
          ? settleDraft(draft, id, along.has(overId) ? id : overId)
          : null
      reset()

      if (!from || !to) return
      if (moving) {
        // The block's place counts the column without the group: the draft
        // holds only the dragged card of it.
        const before = measureBoardCards()
        const stack = event.active.rect.current.translated
        onDrop({ id, from, to, group: moving, event })
        settleGroupDrop({
          before,
          stack: stack ? { top: stack.top, left: stack.left } : null,
          dragged: id,
          group: moving,
        })
        return
      }
      if (from.columnId === to.columnId && from.index === to.index) return
      onDrop({ id, from, to, event })
    },
    [group, onDrop, reset]
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
    /** How many cards the drag moves (1 without a group). */
    activeCount: group?.length ?? 1,
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

function removeFromDraft<C extends string>(
  draft: KanbanDraft<C>,
  ids: ReadonlySet<string>
): KanbanDraft<C> {
  return new Map(
    [...draft].map(([column, cards]) => [
      column,
      cards.filter(card => !ids.has(card)),
    ])
  )
}
