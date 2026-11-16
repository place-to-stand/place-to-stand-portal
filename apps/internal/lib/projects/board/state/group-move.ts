import type { TaskWithRelations } from '@/lib/types'

import { ranksForBlock } from '@/lib/dnd/kanban-group'
import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'
import type { BoardColumnId } from '../board-constants'
import { compareTasksByRank } from '../board-utils'
import type { ColumnTaskFilter } from './dnd-helpers'

export type GroupTaskUpdate = {
  id: string
  status: BoardColumnId
  rank: string
  /** The task changes column, so the save sends its status too. */
  statusChanged: boolean
}

/**
 * Where each card of a group lands (a drag or Send to top / bottom of
 * several selected cards): together at `move.to`, in the group's order,
 * ranked between the cards it lands between. Null when a card is missing.
 */
export function planGroupMove(
  move: KanbanMove<BoardColumnId> & { group: readonly string[] },
  projectTasks: readonly TaskWithRelations[],
  filterColumnTasks?: ColumnTaskFilter
): GroupTaskUpdate[] | null {
  const moving = new Set(move.group)
  const byId = new Map(projectTasks.map(task => [task.id, task]))
  const tasks = move.group.flatMap(id => {
    const task = byId.get(id)
    return task ? [task] : []
  })
  if (tasks.length !== move.group.length) return null

  const column = move.to.columnId
  const others = projectTasks
    .filter(task => task.status === column && !moving.has(task.id))
    .sort(compareTasksByRank)
  const shown = filterColumnTasks ? filterColumnTasks(column, others) : others
  const shownIds = new Set(shown.map(task => task.id))
  const hidden = others.filter(task => !shownIds.has(task.id))
  const ranks = ranksForBlock(shown, move.to.index, hidden, tasks.length)

  return tasks.map((task, index) => ({
    id: task.id,
    status: column,
    rank: ranks[index]!,
    statusChanged: task.status !== column,
  }))
}
