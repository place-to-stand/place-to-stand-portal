import { useMemo } from 'react'

import { filterTasksByAssignee } from '@/lib/projects/board/board-filters'
import type { TaskWithRelations } from '@/lib/types'

export type ProjectsBoardDerivedStateArgs = {
  activeProjectTasks: TaskWithRelations[]
  activeProjectArchivedTasks: TaskWithRelations[]
  activeProjectAcceptedTasks: TaskWithRelations[]
  tasksByColumn: Map<string, TaskWithRelations[]>
  onlyAssignedToMe: boolean
  currentUserId: string | null
  canAcceptTasks: boolean
}

export type ProjectsBoardDerivedState = {
  tasksByColumnToRender: Map<string, TaskWithRelations[]>
  acceptedTasks: TaskWithRelations[]
  archivedTasks: TaskWithRelations[]
  doneColumnTasks: TaskWithRelations[]
  acceptAllDisabled: boolean
  acceptAllDisabledReason: string | null
}

export function useProjectsBoardDerivedState({
  activeProjectArchivedTasks,
  activeProjectAcceptedTasks,
  tasksByColumn,
  onlyAssignedToMe,
  currentUserId,
  canAcceptTasks,
}: ProjectsBoardDerivedStateArgs): ProjectsBoardDerivedState {
  const tasksByColumnToRender = useMemo(() => {
    if (!onlyAssignedToMe || !currentUserId) {
      return tasksByColumn
    }

    return filterTasksByAssignee(tasksByColumn, currentUserId)
  }, [onlyAssignedToMe, currentUserId, tasksByColumn])

  const doneColumnTasks = useMemo(
    () => tasksByColumnToRender.get('DONE') ?? [],
    [tasksByColumnToRender]
  )

  const hasAcceptableTasks = doneColumnTasks.length > 0
  const acceptAllDisabled = !canAcceptTasks || !hasAcceptableTasks
  const acceptAllDisabledReason = !canAcceptTasks
    ? 'Only administrators can accept tasks.'
    : !hasAcceptableTasks
      ? 'No tasks are ready for acceptance.'
      : null

  return {
    tasksByColumnToRender,
    acceptedTasks: activeProjectAcceptedTasks,
    archivedTasks: activeProjectArchivedTasks,
    doneColumnTasks,
    acceptAllDisabled,
    acceptAllDisabledReason,
  }
}
