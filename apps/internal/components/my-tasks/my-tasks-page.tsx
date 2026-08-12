'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { Button } from '@pts/ui/button'
import type { AppUser } from '@/lib/auth/session'
import type {
  DbUser,
  ProjectTypeValue,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import { createRenderAssignees } from '@/lib/projects/board/board-selectors'
import { PROJECT_SPECIAL_SEGMENTS } from '@/lib/projects/board/board-utils'
import { ProjectsBoardEmpty } from '@/app/(dashboard)/projects/_components/projects-board-empty'
import { TaskSheet } from '@/app/(dashboard)/projects/task-sheet'
import { useMyTasksReorderMutation } from '@/lib/projects/tasks/use-my-tasks-data'
import type { MyTaskStatus } from '@/lib/projects/tasks/my-tasks-constants'
import { NEW_SHEET_VALUE } from '@/lib/sheets/entities'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

import { MyTasksBoard } from './my-tasks-board'
import type { MyTasksBoardReorderUpdate, TaskLookup } from './my-tasks-board'
import { MyTasksCalendar } from './my-tasks-calendar'
import { PersonSelector } from './person-selector'
import { Plus } from 'lucide-react'

export type MyTasksInitialEntry = {
  taskId: string
  projectId: string
  sortOrder: number | null
}

export type MyTasksView = 'board' | 'calendar'

type MyTasksPageProps = {
  user: AppUser
  admins: DbUser[]
  projects: ProjectWithRelations[]
  projectSelectionProjects: ProjectWithRelations[]
  initialEntries: MyTasksInitialEntry[]
  activeTaskId: string | null
  view: MyTasksView
  selectedAssigneeId: string
  doneWeeks: number
  olderDoneCount: number
}

export function MyTasksPage({
  user,
  admins,
  projects,
  projectSelectionProjects,
  initialEntries,
  activeTaskId,
  view,
  selectedAssigneeId,
  doneWeeks,
  olderDoneCount,
}: MyTasksPageProps) {
  const router = useRouter()
  const reorderMutation = useMyTasksReorderMutation()
  // Raw `?task=` value — the server prop is uuid-guarded, so `new` only
  // shows up here.
  const { get: getSheetParam } = useSheetParams()
  const taskParam = getSheetParam('task')
  const [createTaskContext, setCreateTaskContext] = useState<{
    status: MyTaskStatus
    assigneeId: string
    projectId: string | null
  } | null>(null)
  const [, startRefresh] = useTransition()
  const boardScrollStorageKey = useMemo(
    () => `my-tasks-board:${user.id}`,
    [user.id]
  )
  const calendarScrollStorageKey = useMemo(
    () => `my-tasks-calendar:${user.id}`,
    [user.id]
  )

  const taskLookup = useMemo(() => buildTaskLookup(projects), [projects])
  const sanitizedEntries = useMemo(
    () => initialEntries.filter(entry => taskLookup.has(entry.taskId)),
    [initialEntries, taskLookup]
  )

  const [entries, setEntries] =
    useState<MyTasksInitialEntry[]>(sanitizedEntries)

  // Reset local copies when their inputs change, using the
  // adjust-state-during-render pattern instead of resync effects.
  const [prevSanitizedEntries, setPrevSanitizedEntries] =
    useState(sanitizedEntries)
  if (prevSanitizedEntries !== sanitizedEntries) {
    setPrevSanitizedEntries(sanitizedEntries)
    setEntries(sanitizedEntries)
  }

  // The `?task=` param is the source of truth: `new` = create, uuid = edit.
  const isCreatingTask = taskParam === NEW_SHEET_VALUE
  const isSheetOpen = isCreatingTask || Boolean(activeTaskId)

  // Drop the create seed defaults once the create sheet's param is gone.
  const [prevTaskParam, setPrevTaskParam] = useState(taskParam)
  if (prevTaskParam !== taskParam) {
    setPrevTaskParam(taskParam)
    if (taskParam !== NEW_SHEET_VALUE) {
      setCreateTaskContext(null)
    }
  }

  const memberDirectory = useMemo(
    () => buildMemberDirectory(projects, admins),
    [projects, admins]
  )
  const renderAssignees = useMemo(
    () => createRenderAssignees(memberDirectory),
    [memberDirectory]
  )

  const taskContexts = useMemo(
    () => buildTaskContextLookup(taskLookup),
    [taskLookup]
  )

  const handleDueDateChange = useCallback(
    (taskId: string, dueOn: string | null) => {
      const lookup = taskLookup.get(taskId)

      if (!lookup) {
        return
      }

      lookup.task.due_on = dueOn
      setEntries(current => [...current])
    },
    [taskLookup]
  )

  const handleCalendarRefresh = useCallback(() => {
    startRefresh(() => {
      router.refresh()
    })
  }, [router, startRefresh])

  const getTaskCardOptions = useCallback(
    (task: TaskWithRelations) => ({
      context: taskContexts.get(task.id),
      hideAssignees: selectedAssigneeId === user.id,
    }),
    [taskContexts, selectedAssigneeId, user.id]
  )


  const activeTaskMeta = activeTaskId
    ? (taskLookup.get(activeTaskId) ?? null)
    : null
  const editingTaskMeta = isCreatingTask ? null : activeTaskMeta
  const shouldKeepTaskSheetMounted = Boolean(
    editingTaskMeta || createTaskContext || isSheetOpen
  )
  const [shouldRenderTaskSheet, setShouldRenderTaskSheet] = useState(
    shouldKeepTaskSheetMounted
  )

  // Mounting happens immediately (adjusted during render); the effect only
  // handles the delayed unmount that lets the close animation finish.
  if (shouldKeepTaskSheetMounted && !shouldRenderTaskSheet) {
    setShouldRenderTaskSheet(true)
  }

  useEffect(() => {
    if (shouldKeepTaskSheetMounted) {
      return
    }

    const timeout = setTimeout(() => {
      setShouldRenderTaskSheet(false)
    }, 300)

    return () => {
      clearTimeout(timeout)
    }
  }, [shouldKeepTaskSheetMounted])

  const searchParams = useSearchParams()

  // Task selection travels as `?task=` (sheet deep-link convention),
  // alongside the assignee filter this view already carries.
  const buildViewPath = useCallback(
    (targetView: MyTasksView, taskId?: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (taskId) {
        params.set('task', taskId)
      } else {
        params.delete('task')
      }
      const queryString = params.toString()
      return `/my/tasks/${targetView}${queryString ? `?${queryString}` : ''}`
    },
    [searchParams]
  )

  const handleOpenTask = useCallback(
    (taskId: string) => {
      router.push(buildViewPath(view, taskId), { scroll: false })
    },
    [buildViewPath, router, view]
  )

  const handleSheetChange = useCallback(
    (open: boolean) => {
      if (open) {
        return
      }

      setCreateTaskContext(null)
      // Close replaces so Back doesn't bounce straight back into the sheet.
      router.replace(buildViewPath(view), { scroll: false })
      startRefresh(() => {
        router.refresh()
      })
    },
    [buildViewPath, router, startRefresh, view]
  )

  const handleReorder = useCallback(
    (update: MyTasksBoardReorderUpdate) => {
      setEntries(update.nextEntries)

      startRefresh(async () => {
        try {
          await reorderMutation.mutateAsync({
            ...update.payload,
            assigneeId: selectedAssigneeId,
          })
          router.refresh()
        } catch {
          setEntries(update.previousEntries)
        }
      })
    },
    [reorderMutation, router, selectedAssigneeId, startRefresh]
  )

  const totalTaskCount = entries.length

  // `?task=new` opens the create sheet (shared convention), so an "add task"
  // link is shareable; the local context only carries the seed defaults for
  // the column the create was started from.
  const handleStartCreateTask = useCallback(
    (status: MyTaskStatus = 'ON_DECK') => {
      setCreateTaskContext({
        status,
        assigneeId: user.id,
        projectId: null,
      })
      router.push(buildViewPath(view, NEW_SHEET_VALUE), { scroll: false })
    },
    [buildViewPath, router, user.id, view]
  )

  const viewTabs = [
    { value: 'board', label: 'Board', href: buildViewPath('board', activeTaskId) },
    {
      value: 'calendar',
      label: 'Calendar',
      href: buildViewPath('calendar', activeTaskId),
    },
  ]

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/my/tasks/board')}
      tabs={viewTabs}
      activeTab={view}
      count={{ label: 'tasks', total: totalTaskCount }}
      primaryAction={
        <div className='flex items-center gap-2'>
          <PersonSelector
            admins={admins}
            selectedUserId={selectedAssigneeId}
            currentUserId={user.id}
          />
          <Button
            type='button'
            size='sm'
            onClick={() => handleStartCreateTask('ON_DECK')}
          >
            <Plus className='h-4 w-4' />
            Add task
          </Button>
        </div>
      }
      contentClassName='flex flex-col gap-4 sm:gap-6'
    >
      {view === 'board' ? (
        // Only truly empty when nothing is hidden either. With older DONE
        // tasks outside the window the board must still render, or its
        // "load previous two weeks" control never mounts and the tasks are
        // unreachable at any window size.
        entries.length === 0 && olderDoneCount === 0 ? (
          <ProjectsBoardEmpty
            title='No tasks assigned'
            description='Once a task is assigned to you, it will appear here.'
          />
        ) : (
          <MyTasksBoard
            entries={entries}
            taskLookup={taskLookup}
            renderAssignees={renderAssignees}
            getTaskCardOptions={getTaskCardOptions}
            onOpenTask={handleOpenTask}
            onReorder={handleReorder}
            activeTaskId={activeTaskId}
            scrollStorageKey={boardScrollStorageKey}
            onCreateTask={handleStartCreateTask}
            doneWeeks={doneWeeks}
            olderDoneCount={olderDoneCount}
          />
        )
      ) : (
        <MyTasksCalendar
          entries={entries}
          taskLookup={taskLookup}
          renderAssignees={renderAssignees}
          onOpenTask={handleOpenTask}
          activeTaskId={activeTaskId}
          onDueDateChange={handleDueDateChange}
          onRefresh={handleCalendarRefresh}
          scrollStorageKey={calendarScrollStorageKey}
        />
      )}
      {shouldRenderTaskSheet ? (
        <TaskSheet
          open={isSheetOpen}
          onOpenChange={handleSheetChange}
          task={editingTaskMeta?.task}
          canManage
          admins={admins}
          currentUserId={user.id}
          defaultStatus={createTaskContext?.status ?? 'ON_DECK'}
          defaultDueOn={null}
          projects={projects}
          projectSelectionProjects={projectSelectionProjects}
          defaultProjectId={
            createTaskContext?.projectId ?? editingTaskMeta?.project.id ?? null
          }
          defaultAssigneeId={createTaskContext?.assigneeId ?? null}
        />
      ) : null}
    </PageShell>
  )
}

type TaskContextMeta = {
  clientLabel: string
  clientHref: string | null
  projectLabel: string
  projectHref: string | null
  layout: 'inline' | 'stacked'
  projectType: ProjectTypeValue
}

function buildTaskLookup(projects: ProjectWithRelations[]): TaskLookup {
  const map: TaskLookup = new Map()

  projects.forEach(project => {
    project.tasks.forEach(task => {
      map.set(task.id, { task, project })
    })
  })

  return map
}

function buildMemberDirectory(
  projects: ProjectWithRelations[],
  admins: DbUser[]
) {
  const directory = new Map<
    string,
    { name: string; avatarUrl: string | null }
  >()

  projects.forEach(project => {
    project.members.forEach(member => {
      const user = member.user
      const name =
        user.full_name?.trim() ||
        user.email?.split('@')[0] ||
        'Unassigned member'
      directory.set(user.id, { name, avatarUrl: user.avatar_url })
    })
  })

  admins.forEach(admin => {
    const name =
      admin.full_name?.trim() || admin.email?.split('@')[0] || 'Administrator'
    directory.set(admin.id, { name, avatarUrl: admin.avatar_url })
  })

  return directory
}

function buildTaskContextLookup(
  lookup: TaskLookup
): Map<string, TaskContextMeta> {
  const map = new Map<string, TaskContextMeta>()

  lookup.forEach(({ project }, taskId) => {
    const clientLabel = resolveClientLabel(project)
    const clientHref = buildClientHref(project)
    const projectHref = buildProjectHref(project)

    map.set(taskId, {
      clientLabel,
      clientHref,
      projectLabel: project.name,
      projectHref,
      layout: 'stacked',
      projectType: project.type,
    })
  })

  return map
}

function resolveClientLabel(project: ProjectWithRelations): string {
  if (project.client?.name) {
    return project.client.name
  }

  if (project.type === 'PERSONAL') {
    return 'Personal'
  }

  if (project.type === 'INTERNAL') {
    return 'Internal'
  }

  return 'Unassigned'
}

function buildClientHref(project: ProjectWithRelations): string | null {
  // Only link to client pages for CLIENT-type projects with a valid client
  if (project.type !== 'CLIENT' || !project.client) {
    return null
  }

  const clientSlug = project.client.slug
  if (clientSlug) {
    return `/clients/${clientSlug}`
  }

  return `/clients/${project.client.id}`
}

function buildProjectHref(project: ProjectWithRelations): string | null {
  if (!project.slug) {
    return null
  }

  if (project.type === 'INTERNAL') {
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.INTERNAL}/${project.slug}/tasks`
  }

  if (project.type === 'PERSONAL') {
    return `/projects/${PROJECT_SPECIAL_SEGMENTS.PERSONAL}/${project.slug}/tasks`
  }

  const clientSlug = project.client?.slug ?? null

  if (!clientSlug) {
    return null
  }

  return `/projects/${clientSlug}/${project.slug}/tasks`
}
