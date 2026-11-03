import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core'

import type { TaskWithRelations } from '@/lib/types'

import {
  clamp,
  extractSortableMeta,
  moveIntoColumn,
  rankAtIndex,
} from '@/lib/dnd/kanban'
import type { BoardColumnId } from '../board-constants'
import { compareTasksByRank } from '../board-utils'
import type { TaskLookup } from './types'

type TaskDragData = {
  type: 'task'
  taskId: string
  projectId: string
  columnId?: BoardColumnId
}

type ColumnDropData = {
  type: 'column'
  columnId: BoardColumnId
}

export type DropPreview = {
  columnId: BoardColumnId
  index: number
}

export type DragComputeEvent = DragOverEvent | DragEndEvent

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

const resolveDestinationColumnId = (
  over: DragEndEvent['over'],
  fallback: BoardColumnId
): BoardColumnId | null => {
  if (!over) {
    return null
  }

  const overData = over.data?.current as
    TaskDragData | ColumnDropData | undefined

  const sortable = extractSortableMeta(over.data?.current)

  if (overData?.type === 'task') {
    if (sortable) {
      return sortable.containerId as BoardColumnId
    }

    if (overData.columnId) {
      return overData.columnId
    }

    return fallback
  }

  if (overData?.type === 'column') {
    return overData.columnId
  }

  if (typeof over.id === 'string') {
    return over.id as BoardColumnId
  }

  return null
}

/**
 * Narrows a status-filtered column to the tasks the board actually renders
 * (e.g. the Done column's rolling window). Sortable indexes on drag events
 * are positions in the rendered list, so rank math has to run against the
 * same list or a drop lands between the wrong neighbors.
 */
export type ColumnTaskFilter = (
  columnId: BoardColumnId,
  tasks: TaskWithRelations[]
) => TaskWithRelations[]

export const deriveReorderPlan = (
  event: DragComputeEvent,
  tasksByProject: TaskLookup,
  filterColumnTasks?: ColumnTaskFilter
): ReorderPlan | null => {
  const activeData = event.active.data.current as TaskDragData | undefined

  if (!activeData || activeData.type !== 'task') {
    return null
  }

  const activeSortable = extractSortableMeta(event.active.data.current)

  if (!activeSortable) {
    return null
  }

  const projectId = activeData.projectId
  const taskId = activeData.taskId
  const projectTasks = tasksByProject.get(projectId)

  if (!projectTasks) {
    return null
  }

  const currentTask = projectTasks.find(task => task.id === taskId) ?? null

  if (!currentTask) {
    return null
  }

  const sourceColumnId = activeSortable.containerId as BoardColumnId
  const destinationColumnId = resolveDestinationColumnId(
    event.over,
    sourceColumnId
  )

  if (!destinationColumnId) {
    return null
  }

  const rawDestinationTasks =
    sourceColumnId === destinationColumnId
      ? getColumnTasks(projectTasks, sourceColumnId)
      : getColumnTasks(projectTasks, destinationColumnId)

  const destinationTasks = filterColumnTasks
    ? filterColumnTasks(destinationColumnId, rawDestinationTasks)
    : rawDestinationTasks

  const overSortable = extractSortableMeta(event.over?.data?.current)

  let targetIndex = overSortable ? overSortable.index : destinationTasks.length

  const sameColumn = sourceColumnId === destinationColumnId
  if (sameColumn && destinationTasks.length === 0) {
    targetIndex = 0
  } else {
    // A card can land after the last card only when it comes from another
    // column.
    const lastIndex = destinationTasks.length - (sameColumn ? 1 : 0)
    targetIndex = clamp(targetIndex, 0, lastIndex)
  }

  return {
    projectId,
    taskId,
    projectTasks,
    currentTask,
    sourceColumnId,
    destinationColumnId,
    destinationTasks,
    activeIndex: activeSortable.index,
    targetIndex,
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
