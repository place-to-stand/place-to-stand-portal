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
}: MyTasksPageProps) {
  const router = useRouter()
  const reorderMutation = useMyTasksReorderMutation()
  const [isSheetOpen, setIsSheetOpen] = useState(Boolean(activeTaskId))
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

  const [prevSheetSync, setPrevSheetSync] = useState({
    activeTaskId,
    createTaskContext,
  })
  if (
    prevSheetSync.activeTaskId !== activeTaskId ||
    prevSheetSync.createTaskContext !== createTaskContext
  ) {
    setPrevSheetSync({ activeTaskId, createTaskContext })
    if (!createTaskContext) {
      setIsSheetOpen(Boolean(activeTaskId))
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
  const editingTaskMeta = createTaskContext ? null : activeTaskMeta
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

  const buildViewPath = useCallback(
    (targetView: MyTasksView, taskId?: string | null) => {
      const suffix = taskId ? `/${taskId}` : ''
      const assigneeParam = searchParams.get('assignee')
      const queryString = assigneeParam ? `?assignee=${assigneeParam}` : ''
      return `/my/tasks/${targetView}${suffix}${queryString}`
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
      if (!open) {
        setIsSheetOpen(false)
        if (createTaskContext) {
          setCreateTaskContext(null)
          startRefresh(() => {
            router.refresh()
          })
          return
        }
        router.push(buildViewPath(view), { scroll: false })
        startRefresh(() => {
          router.refresh()
        })
        return
      }

      setIsSheetOpen(true)
    },
    [buildViewPath, createTaskContext, router, startRefresh, view]
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

  const handleStartCreateTask = useCallback(
    (status: MyTaskStatus = 'ON_DECK') => {
      setCreateTaskContext({
        status,
        assigneeId: user.id,
        projectId: null,
      })
      setIsSheetOpen(true)
    },
    [user.id]
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
        entries.length === 0 ? (
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
