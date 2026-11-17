'use client'

import { toastLink, useToast } from '@/components/ui/use-toast'
import { markDoneMove } from '@/lib/dnd/mark-done'
import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'

/**
 * Mark as done on a task board, for a card's menu and the bulk bar. Given
 * the cards to mark (one card, or the selection in board order), it gives
 * back the action, or null when they are all done already. The action is
 * the board's own move to the top of Done, so it shows at once, saves as a
 * drag would and rolls back on failure; a toast says what happened.
 */
export function useMarkDone<C extends string>({
  columns,
  idsIn,
  done,
  onMove,
  nameOf,
}: {
  columns: readonly C[]
  /** A column's cards as the board shows them. */
  idsIn: (columnId: C) => readonly string[]
  done: C
  onMove: (move: KanbanMove<C>) => void
  nameOf: (id: string) => string | undefined
}) {
  const { toast } = useToast()
  return (ids: readonly string[]): (() => void) | null => {
    const placeOf = (id: string) => {
      for (const columnId of columns) {
        const index = idsIn(columnId).indexOf(id)
        if (index >= 0) return { columnId, index }
      }
      return null
    }
    const move = markDoneMove(ids, placeOf, done)
    if (!move) return null
    return () => {
      onMove(move)
      const count = move.group?.length ?? 1
      toast(
        count > 1
          ? { title: `Marked ${count} tasks as done` }
          : {
              title: 'Marked as done',
              description: nameOf(move.id),
              link: toastLink('task', move.id),
            }
      )
    }
  }
}
