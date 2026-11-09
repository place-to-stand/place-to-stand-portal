import type { TaskWithRelations } from '@/lib/types'

import { moveIntoColumn, rankAtIndex } from '@/lib/dnd/kanban'
import type { KanbanDrop } from '@/lib/dnd/use-kanban-drag'
import type { BoardColumnId } from '../board-constants'
import { compareTasksByRank } from '../board-utils'
import type { TaskLookup } from './types'

type TaskDragData = {
  type: 'task'
  taskId: string
  projectId: string
  columnId?: BoardColumnId
}

export type ReorderPlan = {
  projectId: string
  taskId: string
  projectTasks: TaskWithRelations[]
  currentTask: TaskWithRelations
  sourceColumnId: BoardColumnId
  destinationColumnId: BoardColumnId
  destinationTasks: TaskWithRelations[]
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

/** The move a drop asks for, against the project's current tasks. */
export const deriveReorderPlan = (
  { id: taskId, from, to, event }: KanbanDrop<BoardColumnId>,
  tasksByProject: TaskLookup,
  filterColumnTasks?: ColumnTaskFilter
): ReorderPlan | null => {
  const activeData = event.active.data.current as TaskDragData | undefined

  if (!activeData || activeData.type !== 'task') {
    return null
  }

  const projectId = activeData.projectId
  const projectTasks = tasksByProject.get(projectId)
  const currentTask = projectTasks?.find(task => task.id === taskId)

  if (!projectTasks || !currentTask) {
    return null
  }

  const rawDestinationTasks = getColumnTasks(projectTasks, to.columnId)
  const destinationTasks = filterColumnTasks
    ? filterColumnTasks(to.columnId, rawDestinationTasks)
    : rawDestinationTasks

  return {
    projectId,
    taskId,
    projectTasks,
    currentTask,
    sourceColumnId: from.columnId,
    destinationColumnId: to.columnId,
    destinationTasks,
    activeIndex: from.index,
    targetIndex: to.index,
  }
}

export const prepareReorderOutcome = (plan: ReorderPlan): ReorderOutcome => {
  const {
    destinationTasks,
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

  const nextRank = rankAtIndex(orderedTasks, nextIndex)

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
