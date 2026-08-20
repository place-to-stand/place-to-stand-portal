'use client'

import { ProjectsBoardTabs } from './projects-board-tabs'
import type { ProjectsBoardTabsProps } from './projects-board-tabs'

type NavigationProps = Pick<
  ProjectsBoardTabsProps,
  | 'overviewHref'
  | 'boardHref'
  | 'activityHref'
  | 'reviewHref'
  | 'timeLogsHref'
  | 'activityDisabled'
  | 'reviewDisabled'
  | 'timeLogsDisabled'
>

type BoardProps = Pick<
  ProjectsBoardTabsProps,
  | 'feedback'
  | 'activeProject'
  | 'canManageTasks'
  | 'renderAssignees'
  | 'tasksByColumn'
  | 'onEditTask'
  | 'onCreateTask'
  | 'activeSheetTaskId'
  | 'activityTargetClientId'
  | 'doneWeeks'
  | 'hiddenDoneCount'
  | 'onWidenDoneWindow'
>

type DragProps = Pick<
  ProjectsBoardTabsProps,
  | 'sensors'
  | 'onDragStart'
  | 'onDragOver'
  | 'onDragEnd'
  | 'draggingTask'
  | 'isPending'
  | 'boardViewportRef'
  | 'onBoardScroll'
>

type ReviewProps = Pick<
  ProjectsBoardTabsProps,
  | 'doneTasks'
  | 'acceptedTasks'
  | 'archivedTasks'
  | 'onAcceptAllDone'
  | 'acceptAllDisabled'
  | 'acceptAllDisabledReason'
  | 'isAcceptingDone'
  | 'onAcceptTask'
  | 'onUnacceptTask'
  | 'onRestoreTask'
  | 'onDestroyTask'
  | 'reviewActionTaskId'
  | 'reviewActionType'
  | 'isReviewActionPending'
>

type DropProps = Pick<
  ProjectsBoardTabsProps,
  'activeDropColumnId' | 'dropPreview' | 'recentlyMovedTaskId'
>

type TimeLogsProps = Pick<
  ProjectsBoardTabsProps,
  'currentUserId' | 'onEditTimeLogEntry'
>

export type ProjectsBoardTabsSectionProps = {
  initialTab: ProjectsBoardTabsProps['initialTab']
  navigation: NavigationProps
  board: BoardProps
  drag: DragProps
  review: ReviewProps
  drop: DropProps
  timeLogs: TimeLogsProps
}

type ProjectsBoardTabsSectionComponentProps = ProjectsBoardTabsSectionProps & {
  projectActions: ProjectsBoardTabsProps['projectActions']
  onProjectStatusChange: ProjectsBoardTabsProps['onProjectStatusChange']
}

export function ProjectsBoardTabsSection({
  initialTab,
  navigation,
  board,
  drag,
  review,
  drop,
  timeLogs,
  projectActions,
  onProjectStatusChange,
}: ProjectsBoardTabsSectionComponentProps) {
  return (
    <ProjectsBoardTabs
      initialTab={initialTab}
      {...navigation}
      {...board}
      {...drag}
      {...review}
      {...drop}
      {...timeLogs}
      projectActions={projectActions}
      onProjectStatusChange={onProjectStatusChange}
    />
  )
}
