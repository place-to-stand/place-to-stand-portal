import { useMemo } from 'react'

import type { TaskWithRelations } from '@/lib/types'

export type ProjectsBoardDerivedStateArgs = {
  activeProjectTasks: TaskWithRelations[]
  activeProjectArchivedTasks: TaskWithRelations[]
  activeProjectAcceptedTasks: TaskWithRelations[]
  tasksByColumn: Map<string, TaskWithRelations[]>
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
}: ProjectsBoardDerivedStateArgs): ProjectsBoardDerivedState {
  const tasksByColumnToRender = tasksByColumn

  const doneColumnTasks = useMemo(
    () => tasksByColumnToRender.get('DONE') ?? [],
    [tasksByColumnToRender]
  )

  const hasAcceptableTasks = doneColumnTasks.length > 0
  const acceptAllDisabled = !hasAcceptableTasks
  const acceptAllDisabledReason = !hasAcceptableTasks
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
