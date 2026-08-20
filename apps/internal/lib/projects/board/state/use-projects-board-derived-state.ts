import type { TaskWithRelations } from '@/lib/types'

export type ProjectsBoardDerivedStateArgs = {
  activeProjectTasks: TaskWithRelations[]
  activeProjectArchivedTasks: TaskWithRelations[]
  activeProjectAcceptedTasks: TaskWithRelations[]
  tasksByColumn: Map<string, TaskWithRelations[]>
  /**
   * Full unaccepted DONE list, unwindowed. `tasksByColumn`'s DONE bucket is
   * limited to the board's rolling window, but review and accept-all must see
   * every task still awaiting acceptance.
   */
  allDoneTasks: TaskWithRelations[]
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
  allDoneTasks,
}: ProjectsBoardDerivedStateArgs): ProjectsBoardDerivedState {
  const tasksByColumnToRender = tasksByColumn

  const hasAcceptableTasks = allDoneTasks.length > 0
  const acceptAllDisabled = !hasAcceptableTasks
  const acceptAllDisabledReason = !hasAcceptableTasks
    ? 'No tasks are ready for acceptance.'
    : null

  return {
    tasksByColumnToRender,
    acceptedTasks: activeProjectAcceptedTasks,
    archivedTasks: activeProjectArchivedTasks,
    doneColumnTasks: allDoneTasks,
    acceptAllDisabled,
    acceptAllDisabledReason,
  }
}
