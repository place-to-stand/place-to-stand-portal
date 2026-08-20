import { useCallback, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { TaskWithRelations } from '@/lib/types'
import {
  DONE_WINDOW_WEEKS,
  MAX_DONE_WEEKS,
  isCompletedWithinDoneWindow,
  resolveDoneWindowStart,
} from '@/lib/projects/tasks/done-window'

import { BOARD_COLUMNS, getBoardViewFromPathname } from '../board-constants'
import {
  createClientSlugLookup,
  createProjectLookup,
  createProjectsByClientLookup,
  groupTasksByColumn,
} from '../board-utils'
import { useBoardDnDState } from '../state/use-board-dnd'
import { useBoardNavigation } from '../state/use-board-navigation'
import { useBoardSelectionState } from '../state/use-board-selection'
import { useBoardSheetState } from '../state/use-board-sheet-state'
import { useBoardTaskCollections } from '../state/use-board-task-collections'

import type {
  MemberDirectoryEntry,
  ProjectsBoardState,
  UseProjectsBoardStateArgs,
} from './types'

export const useProjectsBoardState = ({
  projects,
  clients,
  currentUserId,
  admins,
  activeProjectId,
  activeTaskId,
  currentView,
  now,
}: UseProjectsBoardStateArgs): ProjectsBoardState => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)
  const routeView = getBoardViewFromPathname(pathname)

  const projectLookup = useMemo(() => createProjectLookup(projects), [projects])
  const projectsByClientId = useMemo(
    () => createProjectsByClientLookup(projects),
    [projects]
  )
  const clientSlugLookup = useMemo(
    () => createClientSlugLookup(clients),
    [clients]
  )

  const navigateToProject = useBoardNavigation({
    router,
    pathname,
    search: searchParams.toString(),
    projectLookup,
    projectsByClientId,
    clientSlugLookup,
    setFeedback,
  })

  const {
    selectedProjectId,
    projectItems,
    projectGroups,
    canSelectNextProject,
    canSelectPreviousProject,
    handleProjectSelect,
    handleSelectNextProject,
    handleSelectPreviousProject,
  } = useBoardSelectionState({
    projects,
    activeProjectId,
    startTransition,
    navigateToProject,
    setFeedback,
    currentView: routeView ?? currentView,
    currentUserId,
  })

  const {
    tasksByProject,
    setTasksByProject,
    archivedTasksByProject,
    acceptedTasksByProject,
  } = useBoardTaskCollections({
    projects,
    startTransition,
  })

  const activeProject = useMemo(() => {
    if (!selectedProjectId) {
      return null
    }
    return projectLookup.get(selectedProjectId) ?? null
  }, [projectLookup, selectedProjectId])

  const activeProjectTasks = useMemo(() => {
    if (!activeProject) {
      return [] as TaskWithRelations[]
    }
    return tasksByProject.get(activeProject.id) ?? activeProject.tasks
  }, [activeProject, tasksByProject])

  const activeProjectArchivedTasks = useMemo(() => {
    if (!activeProject) {
      return [] as TaskWithRelations[]
    }

    return (
      archivedTasksByProject.get(activeProject.id) ??
      activeProject.archivedTasks
    )
  }, [activeProject, archivedTasksByProject])

  const activeProjectAcceptedTasks = useMemo(() => {
    if (!activeProject) {
      return [] as TaskWithRelations[]
    }

    return (
      acceptedTasksByProject.get(activeProject.id) ??
      activeProject.acceptedTasks
    )
  }, [acceptedTasksByProject, activeProject])

  const canManageTasks = activeProject !== null

  const memberDirectory = useMemo(() => {
    const directory = new Map<string, MemberDirectoryEntry>()

    if (activeProject) {
      activeProject.members.forEach(member => {
        directory.set(member.user_id, {
          name: member.user.full_name ?? member.user.email,
          avatarUrl: member.user.avatar_url,
        })
      })
    }

    admins.forEach(admin => {
      if (!directory.has(admin.id)) {
        directory.set(admin.id, {
          name: admin.full_name ?? admin.email,
          avatarUrl: admin.avatar_url,
        })
      }
    })

    return directory
  }, [activeProject, admins])

  // The Done column mirrors the My Tasks board's rolling window: tasks
  // completed before the cutoff are withheld from the column (and only the
  // column — the Review tab and accept-all keep the full set). The whole task
  // graph is already client-side here, so "load previous two weeks" is a
  // local widen rather than the fetch My Tasks needs.
  const [doneWeeks, setDoneWeeks] = useState(DONE_WINDOW_WEEKS)
  // Pinned at mount so SSR and hydration measure from the same instant; the
  // tasks page passes its render-time `now` for the same reason My Tasks does.
  const [doneWindowAnchor] = useState(() => now ?? new Date().toISOString())

  // A different project is a different Done history; carrying a widened
  // window across the switch would quietly change what "recent" means there.
  const [prevProjectIdForDoneWindow, setPrevProjectIdForDoneWindow] =
    useState(selectedProjectId)
  if (prevProjectIdForDoneWindow !== selectedProjectId) {
    setPrevProjectIdForDoneWindow(selectedProjectId)
    setDoneWeeks(DONE_WINDOW_WEEKS)
  }

  const doneWindowStart = useMemo(
    () => resolveDoneWindowStart(doneWeeks, doneWindowAnchor),
    [doneWeeks, doneWindowAnchor]
  )

  const widenDoneWindow = useCallback(() => {
    setDoneWeeks(weeks => Math.min(weeks + DONE_WINDOW_WEEKS, MAX_DONE_WEEKS))
  }, [])

  const fullTasksByColumn = useMemo(
    () => groupTasksByColumn(activeProjectTasks, BOARD_COLUMNS),
    [activeProjectTasks]
  )

  // Full unaccepted DONE list, for the Review tab: acceptance must see every
  // task awaiting it, no matter how long ago it was completed.
  const allDoneTasks = useMemo(
    () => fullTasksByColumn.get('DONE') ?? [],
    [fullTasksByColumn]
  )

  const { tasksByColumn, hiddenDoneCount } = useMemo(() => {
    const visibleDone = allDoneTasks.filter(task =>
      isCompletedWithinDoneWindow(task.completed_at, doneWindowStart)
    )

    if (visibleDone.length === allDoneTasks.length) {
      return { tasksByColumn: fullTasksByColumn, hiddenDoneCount: 0 }
    }

    const windowed = new Map(fullTasksByColumn)
    windowed.set('DONE', visibleDone)

    return {
      tasksByColumn: windowed,
      hiddenDoneCount: allDoneTasks.length - visibleDone.length,
    }
  }, [allDoneTasks, doneWindowStart, fullTasksByColumn])

  // Drag indexes come from the rendered (windowed) column, so rank math must
  // run against that same list — this also excludes accepted DONE tasks,
  // which the column never renders.
  const filterColumnTasksForDnD = useCallback(
    (columnId: string, tasks: TaskWithRelations[]) => {
      if (columnId !== 'DONE') {
        return tasks
      }

      return tasks.filter(
        task =>
          !task.accepted_at &&
          isCompletedWithinDoneWindow(task.completed_at, doneWindowStart)
      )
    },
    [doneWindowStart]
  )

  const {
    isSheetOpen,
    sheetTask,
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
    defaultTaskStatus,
    defaultTaskDueOn,
  } = useBoardSheetState({
    projects,
    tasksByProject,
    selectedProjectId,
    activeProject,
    activeTaskId,
    navigateToProject,
    startTransition,
    currentView,
  })

  const {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    draggingTask,
    activeDropColumnId,
    dropPreview,
    recentlyMovedTaskId,
  } = useBoardDnDState({
    canManageTasks,
    activeProject,
    tasksByProject,
    setTasksByProject,
    activeProjectTasks,
    startTransition,
    setFeedback,
    filterColumnTasks: filterColumnTasksForDnD,
  })

  const addTaskDisabled = !activeProject
  const addTaskDisabledReason = !activeProject
    ? 'Select a project to add tasks.'
    : null

  return {
    isPending,
    feedback,
    selectedProjectId,
    projectItems,
    projectGroups,
    canSelectNextProject,
    canSelectPreviousProject,
    activeProject,
    activeProjectTasks,
    activeProjectArchivedTasks,
    activeProjectAcceptedTasks,
    canManageTasks,
    memberDirectory,
    tasksByColumn,
    allDoneTasks,
    doneWeeks,
    hiddenDoneCount,
    widenDoneWindow,
    draggingTask,
    addTaskDisabled,
    addTaskDisabledReason,
    isSheetOpen,
    sheetTask,
    handleProjectSelect,
    handleDragStart,
    handleDragEnd,
    openCreateSheet,
    handleEditTask,
    handleSheetOpenChange,
    defaultTaskStatus,
    defaultTaskDueOn,
    navigateToProject,
    handleDragOver,
    activeDropColumnId,
    dropPreview,
    recentlyMovedTaskId,
    handleSelectNextProject,
    handleSelectPreviousProject,
  }
}
