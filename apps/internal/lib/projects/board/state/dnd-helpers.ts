import type { TaskWithRelations } from '@/lib/types'

import { moveIntoColumn, rankAmongHidden } from '@/lib/dnd/kanban'
import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'
import type { BoardColumnId } from '../board-constants'
import { compareTasksByRank } from '../board-utils'
import type { TaskLookup } from './types'

export type ReorderPlan = {
  projectId: string
  taskId: string
  projectTasks: TaskWithRelations[]
  currentTask: TaskWithRelations
  sourceColumnId: BoardColumnId
  destinationColumnId: BoardColumnId
  destinationTasks: TaskWithRelations[]
  /**
   * The destination column's tasks the board doesn't render (a search, the
   * Done window). The new rank lands among them too, so no two tasks share
   * one and the order holds once the filter is cleared.
   */
  hiddenDestinationTasks: TaskWithRelations[]
  activeIndex: number
  targetIndex: number
}

export type ReorderOutcome =
  | { status: 'noop' }
  | {
      status: 'update'
      nextRank: string
      destinationStatus: BoardColumnId
      recentlyMoved: boolean
    }

const getColumnTasks = (
  projectTasks: TaskWithRelations[],
  columnId: BoardColumnId
) =>
  projectTasks.filter(task => task.status === columnId).sort(compareTasksByRank)

/**
 * Narrows a status-filtered column to the tasks the board actually renders
 * (e.g. the Done column's rolling window). Drop indexes are positions in the
 * rendered list, so rank math has to run against the same list or a drop
 * lands between the wrong neighbors.
 */
export type ColumnTaskFilter = (
  columnId: BoardColumnId,
  tasks: TaskWithRelations[]
) => TaskWithRelations[]

/**
 * The move a drop (or Send to top / bottom) asks for, against the project's
 * current tasks.
 */
export const deriveReorderPlan = (
  { id: taskId, from, to }: KanbanMove<BoardColumnId>,
  tasksByProject: TaskLookup,
  filterColumnTasks?: ColumnTaskFilter
): ReorderPlan | null => {
  const found = findTaskProject(tasksByProject, taskId)

  if (!found) {
    return null
  }

  const { projectId, projectTasks, currentTask } = found

  const rawDestinationTasks = getColumnTasks(projectTasks, to.columnId)
  const destinationTasks = filterColumnTasks
    ? filterColumnTasks(to.columnId, rawDestinationTasks)
    : rawDestinationTasks

  const shownIds = new Set(destinationTasks.map(task => task.id))
  const hiddenDestinationTasks = rawDestinationTasks.filter(
    task => task.id !== taskId && !shownIds.has(task.id)
  )

  return {
    projectId,
    taskId,
    projectTasks,
    currentTask,
    sourceColumnId: from.columnId,
    destinationColumnId: to.columnId,
    destinationTasks,
    hiddenDestinationTasks,
    activeIndex: from.index,
    targetIndex: to.index,
  }
}

export const prepareReorderOutcome = (plan: ReorderPlan): ReorderOutcome => {
  const {
    destinationTasks,
    hiddenDestinationTasks,
    sourceColumnId,
    destinationColumnId,
    activeIndex,
    targetIndex,
    currentTask,
    taskId,
  } = plan

  const orderedTasks = moveIntoColumn(
    destinationTasks,
    currentTask,
    targetIndex,
    sourceColumnId === destinationColumnId ? { fromIndex: activeIndex } : null
  )

  if (!orderedTasks) {
    return { status: 'noop' }
  }

  const nextIndex = orderedTasks.findIndex(task => task.id === taskId)

  if (nextIndex === -1) {
    return { status: 'noop' }
  }

  const nextRank = rankAmongHidden(
    orderedTasks,
    nextIndex,
    hiddenDestinationTasks
  )

  const destinationStatus = destinationColumnId

  if (
    destinationStatus === currentTask.status &&
    nextRank === currentTask.rank
  ) {
    return { status: 'noop' }
  }

  return {
    status: 'update',
    nextRank,
    destinationStatus,
    recentlyMoved: destinationStatus !== currentTask.status,
  }
}

const findTaskProject = (tasksByProject: TaskLookup, taskId: string) => {
  for (const [projectId, projectTasks] of tasksByProject) {
    const currentTask = projectTasks.find(task => task.id === taskId)
    if (currentTask) return { projectId, projectTasks, currentTask }
  }
  return null
}
