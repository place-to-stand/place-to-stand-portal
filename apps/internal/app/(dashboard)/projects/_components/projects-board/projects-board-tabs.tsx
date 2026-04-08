import { useEffect } from 'react'
import type { RefObject, UIEventHandler } from 'react'
import { Tabs } from '@/components/ui/tabs'
import type { TaskWithRelations } from '@/lib/types'
import type { DndContextProps } from '@dnd-kit/core'
import type { RenderAssigneeFn } from '../../../../../lib/projects/board/board-selectors'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'
import { completeBoardTabInteraction } from '@/lib/projects/board/board-tab-interaction'
import type { UserRole } from '@/lib/auth/session'
import type { TimeLogEntry } from '@/lib/projects/time-log/types'
import type { ProjectStatusValue } from '@/lib/constants'

import { BoardTabContent } from './board-tab-content'
import { ActivityTabContent } from './activity-tab-content'
import { OverviewTabContent } from './overview-tab-content'
import { ReviewTabContent } from './review-tab-content'
import type { ReviewActionKind } from './review-tab/review-tab.types'
import { ProjectsBoardTabsHeader } from './projects-board-tabs-header'
import type { ProjectsBoardActiveProject } from './board-tab-content'
import { TimeLogsTabContent } from './time-logs-tab-content'
import { ScopeTabContent } from '../scope/scope-tab-content'

export type ProjectActionControls = {
  canEdit: boolean
  canArchive: boolean
  editDisabledReason: string | null
  archiveDisabledReason: string | null
  onEdit: () => void
  onArchive: () => void
} | null

export type ProjectsBoardTabsProps = {
  initialTab:
    | 'overview'
    | 'board'
    | 'activity'
    | 'review'
    | 'timeLogs'
    | 'scope'
  overviewHref: string
  boardHref: string
  activityHref: string
  reviewHref: string
  timeLogsHref: string
  scopeHref: string
  activityDisabled: boolean
  reviewDisabled: boolean
  timeLogsDisabled: boolean
  scopeDisabled: boolean
  scopeProjectId: string | null
  feedback: string | null
  activeProject: ProjectsBoardActiveProject
  canManageTasks: boolean
  renderAssignees: RenderAssigneeFn
  tasksByColumn: ReadonlyMap<string, TaskWithRelations[]>
  onEditTask: (task: TaskWithRelations) => void
  onCreateTask: () => void
  sensors: DndContextProps['sensors']
  onDragStart: DndContextProps['onDragStart']
  onDragOver: DndContextProps['onDragOver']
  onDragEnd: DndContextProps['onDragEnd']
  draggingTask: TaskWithRelations | null
  isPending: boolean
  boardViewportRef: RefObject<HTMLDivElement | null>
  onBoardScroll: UIEventHandler<HTMLDivElement>
  activeSheetTaskId: string | null
  activityTargetClientId: string | null
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
  onDestroyTask: (taskId: string) => void
  reviewActionTaskId: string | null
  reviewActionType: ReviewActionKind | null
  reviewActionDisabledReason: string | null
  isReviewActionPending: boolean
  activeDropColumnId: BoardColumnId | null
  dropPreview: { columnId: BoardColumnId; index: number } | null
  recentlyMovedTaskId: string | null
  currentUserId: string
  currentUserRole: UserRole
  canLogTime: boolean
  onEditTimeLogEntry: (entry: TimeLogEntry) => void
  projectActions: ProjectActionControls
  onProjectStatusChange: (
    projectId: string,
    status: ProjectStatusValue
  ) => Promise<void>
}

export function ProjectsBoardTabs(props: ProjectsBoardTabsProps) {
  const {
    initialTab,
    overviewHref,
    boardHref,
    activityHref,
    reviewHref,
    timeLogsHref,
    scopeHref,
    activityDisabled,
    reviewDisabled,
    timeLogsDisabled,
    scopeDisabled,
    scopeProjectId,
    feedback,
    activeProject,
    canManageTasks,
    renderAssignees,
    tasksByColumn,
    onEditTask,
    onCreateTask,
    sensors,
    onDragStart,
    onDragOver,
    onDragEnd,
    draggingTask,
    boardViewportRef,
    onBoardScroll,
    activeSheetTaskId,
    activityTargetClientId,
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
    onDestroyTask,
    reviewActionTaskId,
    reviewActionType,
    reviewActionDisabledReason,
    isReviewActionPending,
    activeDropColumnId,
    dropPreview,
    recentlyMovedTaskId,
    currentUserId,
    currentUserRole,
    canLogTime,
    onEditTimeLogEntry,
    projectActions,
    onProjectStatusChange,
  } = props

  useEffect(() => {
    completeBoardTabInteraction(initialTab)
  }, [initialTab])

  return (
    <Tabs value={initialTab} className='flex min-h-0 flex-1 flex-col gap-2'>
      <ProjectsBoardTabsHeader
        initialTab={initialTab}
        overviewHref={overviewHref}
        boardHref={boardHref}
        activityHref={activityHref}
        reviewHref={reviewHref}
        timeLogsHref={timeLogsHref}
        scopeHref={scopeHref}
        activityDisabled={activityDisabled}
        reviewDisabled={reviewDisabled}
        timeLogsDisabled={timeLogsDisabled}
        scopeDisabled={scopeDisabled}
        projectActions={projectActions}
        activeProjectId={activeProject?.id ?? null}
        activeProjectStatus={activeProject?.status ?? null}
        onProjectStatusChange={onProjectStatusChange}
      />
      <OverviewTabContent
        isActive={initialTab === 'overview'}
        activeProject={activeProject}
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
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        draggingTask={draggingTask}
        boardViewportRef={boardViewportRef}
        onBoardScroll={onBoardScroll}
        activeSheetTaskId={activeSheetTaskId}
        activeDropColumnId={activeDropColumnId}
        dropPreview={dropPreview}
        recentlyMovedTaskId={recentlyMovedTaskId}
      />
      <ReviewTabContent
        isActive={initialTab === 'review'}
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
        onDestroyTask={onDestroyTask}
        reviewActionTaskId={reviewActionTaskId}
        reviewActionType={reviewActionType}
        reviewActionDisabledReason={reviewActionDisabledReason}
        isReviewActionPending={isReviewActionPending}
      />
      <TimeLogsTabContent
        key={activeProject?.id ?? 'no-project'}
        isActive={initialTab === 'timeLogs'}
        activeProject={activeProject}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        canLogTime={canLogTime}
        onEditEntry={onEditTimeLogEntry}
      />
      <ScopeTabContent
        isActive={initialTab === 'scope'}
        projectId={scopeProjectId}
      />
      <ActivityTabContent
        isActive={initialTab === 'activity'}
        activeProject={activeProject}
        activityTargetClientId={activityTargetClientId}
      />
    </Tabs>
  )
}
