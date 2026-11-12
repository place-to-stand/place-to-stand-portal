import { useEffect } from 'react'
import type { ReactNode, RefObject, UIEventHandler } from 'react'
import { Tabs } from '@pts/ui/tabs'
import type { DbUser, TaskWithRelations } from '@/lib/types'
import type { DndContextProps } from '@dnd-kit/core'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import type { KanbanDrop } from '@/lib/dnd/use-kanban-drag'
import { completeBoardTabInteraction } from '@/lib/projects/board/board-tab-interaction'
import type { ProjectStatusValue } from '@/lib/constants'

import { BoardTabContent } from './board-tab-content'
import { ActivityTabContent } from './activity-tab-content'
import { ReviewTabContent } from './review-tab-content'
import type { ReviewActionKind } from './review-tab/review-tab.types'
import { ProjectsBoardTabsHeader } from './projects-board-tabs-header'
import type { ProjectsBoardActiveProject } from './board-tab-content'
import { TimeLogsTabContent } from './time-logs-tab-content'

export type ProjectActionControls = {
  canEdit: boolean
  canArchive: boolean
  editDisabledReason: string | null
  archiveDisabledReason: string | null
  onEdit: () => void
  onArchive: () => void
} | null

export type ProjectsBoardTabsProps = {
  initialTab: 'board' | 'activity' | 'review' | 'timeLogs'
  boardHref: string
  activityHref: string
  reviewHref: string
  timeLogsHref: string
  activityDisabled: boolean
  reviewDisabled: boolean
  timeLogsDisabled: boolean
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  canManageTasks: boolean
  renderAssignees: RenderAssigneeFn
  tasksByColumn: ReadonlyMap<string, TaskWithRelations[]>
  onEditTask: (task: TaskWithRelations) => void
  onCreateTask: () => void
  sensors: DndContextProps['sensors']
  onDragStart: () => void
  onTaskDrop: (drop: KanbanDrop<BoardColumnId>) => void
  isPending: boolean
  boardViewportRef: RefObject<HTMLDivElement | null>
  onBoardScroll: UIEventHandler<HTMLDivElement>
  activeSheetTaskId: string | null
  activityTargetClientId: string | null
  doneWeeks: number
  hiddenDoneCount: number
  onWidenDoneWindow: () => void
  /** The people the board's person filter offers. */
  boardPeople: DbUser[]
  currentUserId: string
  doneTasks: TaskWithRelations[]
  acceptedTasks: TaskWithRelations[]
  archivedTasks: TaskWithRelations[]
  onAcceptAllDone: () => void
  acceptAllDisabled: boolean
  acceptAllDisabledReason: string | null
  isAcceptingDone: boolean
  onAcceptTask: (taskId: string) => void
  onUnacceptTask: (taskId: string) => void
  onRestoreTask: (taskId: string) => void
  reviewActionTaskId: string | null
  reviewActionType: ReviewActionKind | null
  isReviewActionPending: boolean
  recentlyMovedTaskId: string | null
  /** The Time logs tab's list, rendered on the server for its route. */
  timeLogsList?: ReactNode
  /** Project members see the Tasks tab only. */
  tasksOnly?: boolean
  projectActions: ProjectActionControls
  onProjectStatusChange: (
    projectId: string,
    status: ProjectStatusValue
  ) => Promise<void>
}

export function ProjectsBoardTabs(props: ProjectsBoardTabsProps) {
  const {
    initialTab,
    boardHref,
    activityHref,
    reviewHref,
    timeLogsHref,
    activityDisabled,
    reviewDisabled,
    timeLogsDisabled,
    feedback,
    activeProject,
    canManageTasks,
    renderAssignees,
    tasksByColumn,
    onEditTask,
    onCreateTask,
    sensors,
    onDragStart,
    onTaskDrop,
    boardViewportRef,
    onBoardScroll,
    activeSheetTaskId,
    activityTargetClientId,
    doneWeeks,
    hiddenDoneCount,
    onWidenDoneWindow,
    boardPeople,
    currentUserId,
    doneTasks,
    acceptedTasks,
    archivedTasks,
    onAcceptAllDone,
    acceptAllDisabled,
    acceptAllDisabledReason,
    isAcceptingDone,
    onAcceptTask,
    onUnacceptTask,
    onRestoreTask,
    reviewActionTaskId,
    reviewActionType,
    isReviewActionPending,
    recentlyMovedTaskId,
    timeLogsList,
    tasksOnly = false,
    projectActions,
    onProjectStatusChange,
  } = props

  useEffect(() => {
    completeBoardTabInteraction(initialTab)
  }, [initialTab])

  return (
    <Tabs
      value={initialTab}
      className='flex min-h-0 flex-1 flex-col gap-3 sm:gap-4'
    >
      <ProjectsBoardTabsHeader
        initialTab={initialTab}
        boardHref={boardHref}
        activityHref={activityHref}
        reviewHref={reviewHref}
        timeLogsHref={timeLogsHref}
        activityDisabled={activityDisabled}
        reviewDisabled={reviewDisabled}
        timeLogsDisabled={timeLogsDisabled}
        tasksOnly={tasksOnly}
        projectActions={projectActions}
        activeProjectId={activeProject?.id ?? null}
        activeProjectStatus={activeProject?.status ?? null}
        onProjectStatusChange={onProjectStatusChange}
      />
      <BoardTabContent
        isActive={initialTab === 'board'}
        feedback={feedback}
        activeProject={activeProject}
        tasksByColumn={tasksByColumn}
        renderAssignees={renderAssignees}
        canManageTasks={canManageTasks}
        onEditTask={onEditTask}
        onCreateTask={onCreateTask}
        sensors={sensors}
        onDragStart={onDragStart}
        onTaskDrop={onTaskDrop}
        boardViewportRef={boardViewportRef}
        onBoardScroll={onBoardScroll}
        activeSheetTaskId={activeSheetTaskId}
        recentlyMovedTaskId={recentlyMovedTaskId}
        doneWeeks={doneWeeks}
        hiddenDoneCount={hiddenDoneCount}
        onWidenDoneWindow={onWidenDoneWindow}
        boardPeople={boardPeople}
        currentUserId={currentUserId}
      />
      <ReviewTabContent
        isActive={initialTab === 'review'}
        canManageTasks={canManageTasks}
        activeProject={activeProject}
        feedback={feedback}
        doneTasks={doneTasks}
        acceptedTasks={acceptedTasks}
        archivedTasks={archivedTasks}
        renderAssignees={renderAssignees}
        onEditTask={onEditTask}
        onAcceptTask={onAcceptTask}
        onAcceptAllDone={onAcceptAllDone}
        acceptAllDisabled={acceptAllDisabled}
        acceptAllDisabledReason={acceptAllDisabledReason}
        isAcceptingDone={isAcceptingDone}
        activeSheetTaskId={activeSheetTaskId}
        onUnacceptTask={onUnacceptTask}
        onRestoreTask={onRestoreTask}
        reviewActionTaskId={reviewActionTaskId}
        reviewActionType={reviewActionType}
        isReviewActionPending={isReviewActionPending}
      />
      <TimeLogsTabContent
        key={activeProject?.id ?? 'no-project'}
        isActive={initialTab === 'timeLogs'}
        activeProject={activeProject}
        list={timeLogsList}
      />
      <ActivityTabContent
        isActive={initialTab === 'activity'}
        activeProject={activeProject}
        activityTargetClientId={activityTargetClientId}
      />
    </Tabs>
  )
}
