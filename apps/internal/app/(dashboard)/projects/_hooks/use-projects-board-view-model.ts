'use client'

import { useMemo, type ReactNode } from 'react'

import type { ProjectsBoardTabsSectionProps } from '../_components/projects-board/projects-board-tabs-section'
import type { ProjectsBoardDialogsProps } from '../_components/projects-board-dialogs'
import type {
  SearchableComboboxGroup,
  SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'
import { buildProjectsBoardDialogs } from './builders/build-projects-board-dialogs'
import { buildProjectsBoardHeader } from './builders/build-projects-board-header'
import { buildProjectsBoardTabs } from './builders/build-projects-board-tabs'
import {
  useProjectsBoardCoreState,
  type UseProjectsBoardCoreStateArgs,
} from './use-projects-board-core-state'
import { useProjectsBoardNavigation } from './use-projects-board-navigation'
import { useProjectsBoardSensors } from './use-projects-board-sensors'

const NO_PROJECTS_MESSAGE = 'No projects assigned yet.'

type BaseProps = Omit<UseProjectsBoardCoreStateArgs, 'currentView'>

export type ProjectsBoardProps = BaseProps & {
  initialTab?: 'board' | 'activity' | 'review' | 'timeLogs'
  /** The Time logs tab's list, rendered on the server for its route. */
  timeLogsList?: ReactNode
}

export type ProjectsBoardHeaderProps = {
  projectItems: SearchableComboboxItem[]
  projectGroups?: SearchableComboboxGroup[]
  selectedProjectId: string | null
  onProjectChange: (projectId: string | null) => void
  onSelectNextProject: () => void
  onSelectPreviousProject: () => void
  canSelectNext: boolean
  canSelectPrevious: boolean
}

export type ProjectsBoardViewModel = {
  header: ProjectsBoardHeaderProps
  tabs: ProjectsBoardTabsSectionProps
  dialogs: ProjectsBoardDialogsProps
  emptyState: { message: string }
  isEmpty: boolean
}

export function useProjectsBoardViewModel({
  initialTab = 'board',
  ...props
}: ProjectsBoardProps): ProjectsBoardViewModel {
  const currentBoardView = initialTab === 'timeLogs' ? 'board' : initialTab
  const { sensors } = useProjectsBoardSensors()
  const {
    boardState,
    derivedState,
    reviewActions,
    renderAssignees,
    boardViewportRef,
    handleBoardScroll,
  } = useProjectsBoardCoreState({ ...props, currentView: currentBoardView })

  const navigation = useProjectsBoardNavigation({
    activeProject: boardState.activeProject,
    clients: props.clients,
  })

  const activeProjectSummary = useMemo(() => {
    if (!boardState.activeProject) {
      return null
    }

    return {
      id: boardState.activeProject.id,
      name: boardState.activeProject.name,
      slug: boardState.activeProject.slug,
      status: boardState.activeProject.status,
      client: {
        id: boardState.activeProject.client?.id ?? null,
        name: boardState.activeProject.client?.name ?? null,
        slug: boardState.activeProject.client?.slug ?? null,
        billing_type: boardState.activeProject.client?.billing_type ?? null,
      },
      owner: boardState.activeProject.owner,
      starts_on: boardState.activeProject.starts_on,
      ends_on: boardState.activeProject.ends_on,
      githubRepos: boardState.activeProject.githubRepos,
      integrationLinks: boardState.activeProject.integrationLinks,
      burndown: {
        totalClientRemainingHours:
          boardState.activeProject.burndown.totalClientRemainingHours,
        totalProjectLoggedHours:
          boardState.activeProject.burndown.totalProjectLoggedHours,
      },
    }
  }, [boardState.activeProject])

  const reviewActionTaskId = reviewActions.pendingReviewAction?.taskId ?? null
  const reviewActionType = reviewActions.pendingReviewAction?.type ?? null

  const header = buildProjectsBoardHeader({
    projectItems: boardState.projectItems,
    projectGroups: boardState.projectGroups,
    selectedProjectId: boardState.selectedProjectId,
    onProjectChange: boardState.handleProjectSelect,
    onSelectNextProject: boardState.handleSelectNextProject,
    onSelectPreviousProject: boardState.handleSelectPreviousProject,
    canSelectNextProject: boardState.canSelectNextProject,
    canSelectPreviousProject: boardState.canSelectPreviousProject,
  })

  const tabs = buildProjectsBoardTabs({
    initialTab,
    navigation,
    board: {
      feedback: boardState.feedback,
      activeProject: activeProjectSummary,
      canManageTasks: boardState.canManageTasks,
      renderAssignees,
      tasksByColumn: derivedState.tasksByColumnToRender,
      onEditTask: boardState.handleEditTask,
      onCreateTask: boardState.openCreateSheet,
      activeSheetTaskId: boardState.sheetTask?.id ?? null,
      activityTargetClientId: boardState.activeProject?.client?.id ?? null,
      doneWeeks: boardState.doneWeeks,
      hiddenDoneCount: boardState.hiddenDoneCount,
      onWidenDoneWindow: boardState.widenDoneWindow,
      boardPeople: props.admins,
      currentUserId: props.currentUserId,
    },
    drag: {
      sensors,
      onDragStart: boardState.handleDragStart,
      onTaskDrop: boardState.handleTaskDrop,
      isPending: boardState.isPending,
      boardViewportRef,
      onBoardScroll: handleBoardScroll,
    },
    review: {
      doneTasks: derivedState.doneColumnTasks,
      acceptedTasks: derivedState.acceptedTasks,
      archivedTasks: derivedState.archivedTasks,
      onAcceptAllDone: reviewActions.handleAcceptAllDone,
      acceptAllDisabled: derivedState.acceptAllDisabled,
      acceptAllDisabledReason: derivedState.acceptAllDisabledReason,
      isAcceptingDone: reviewActions.isAcceptingDone,
      onAcceptTask: reviewActions.handleAcceptTask,
      onUnacceptTask: reviewActions.handleUnacceptTask,
      onRestoreTask: reviewActions.handleRestoreTask,
      reviewActionTaskId,
      reviewActionType,
      isReviewActionPending: reviewActions.isReviewActionPending,
    },
    drop: {
      recentlyMovedTaskId: boardState.recentlyMovedTaskId,
    },
    timeLogs: { timeLogsList: props.timeLogsList },
  })

  const dialogs = buildProjectsBoardDialogs({
    activeProject: boardState.activeProject,
    sheetState: {
      open: boardState.isSheetOpen,
      onOpenChange: boardState.handleSheetOpenChange,
      task: boardState.sheetTask,
      canManage: boardState.canManageTasks,
      admins: props.admins,
      currentUserId: props.currentUserId,
      defaultStatus: boardState.defaultTaskStatus,
      defaultDueOn: boardState.defaultTaskDueOn,
    },
    projects: props.projects,
  })

  return {
    header,
    tabs,
    dialogs,
    emptyState: { message: NO_PROJECTS_MESSAGE },
    isEmpty: props.projects.length === 0,
  }
}
