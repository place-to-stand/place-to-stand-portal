import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  MyTasksPage,
  type MyTasksInitialEntry,
  type MyTasksView,
} from '@/components/my-tasks/my-tasks-page'
import { requireUser } from '@/lib/auth/session'
import { buildQuerySuffix } from '@/lib/sheets/hrefs'
import {
  fetchProjectsLite,
  fetchProjectsWithRelationsByIds,
} from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import {
  getActiveTaskProjectId,
  listAssignedTaskSummaries,
} from '@/lib/data/tasks'
import {
  DONE_WINDOW_WEEKS,
  resolveDoneWindowStart,
} from '@/lib/projects/tasks/done-window'

export const metadata: Metadata = {
  title: 'My Tasks | Place to Stand Portal',
}

type PageParams = {
  view: string
}

type PageSearchParams = {
  assignee?: string
  task?: string
}

type PageProps = {
  params: Promise<PageParams>
  searchParams: Promise<PageSearchParams>
}

const DEFAULT_VIEW: MyTasksView = 'board'

export default async function MyTasksViewRoute({
  params,
  searchParams,
}: PageProps) {
  const user = await requireUser()
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const viewParam = resolvedParams.view
  const activeTaskId = resolvedSearchParams.task ?? null

  if (!isMyTasksView(viewParam)) {
    // Carry the whole query string across the redirect — the sheet stack and
    // the `?assignee=` filter both live there.
    redirect(`/my/tasks/${DEFAULT_VIEW}${buildQuerySuffix(resolvedSearchParams)}`)
  }

  // Lite projects feed only the sheet's project selector; the task graph is
  // hydrated below for just the projects that hold assigned tasks.
  const [admins, liteProjects] = await Promise.all([
    fetchAdminUsers(),
    fetchProjectsLite(),
  ])

  // Allow viewing another admin's tasks via the assignee param
  const requestedAssigneeId = resolvedSearchParams.assignee ?? user.id
  const selectedAssigneeId =
    requestedAssigneeId !== user.id &&
    admins.some(admin => admin.id === requestedAssigneeId)
      ? requestedAssigneeId
      : user.id

  // The Done column starts at one window and widens on demand via
  // /api/my-tasks/done-window, so the first load never carries the whole
  // completed archive.
  //
  // Board only. The calendar plots by due date and has no Done column, so
  // windowing there would quietly erase history from past months.
  const now = new Date().toISOString()
  const isBoardView = viewParam === 'board'

  const assignedSummaries = await listAssignedTaskSummaries({
    userId: selectedAssigneeId,
    limit: null,
    doneSince: isBoardView
      ? resolveDoneWindowStart(DONE_WINDOW_WEEKS, now)
      : null,
  })

  const includedProjectIds = new Set<string>()
  const orderedProjectIds: string[] = []

  const initialEntries: MyTasksInitialEntry[] = []

  assignedSummaries.items.forEach(item => {
    // Lead-anchored tasks have no project (PRD 005 D8), and this board is built
    // by hydrating project graphs and grouping tasks under them — there is no
    // group for a project-less task to join. They reach the assignee through
    // the dashboard My Tasks widget, which renders a flat list. Placing them on
    // this board needs a grouping model the PRD does not specify; see
    // PROGRESS.md §04.
    if (!item.project) {
      return
    }

    if (!includedProjectIds.has(item.project.id)) {
      includedProjectIds.add(item.project.id)
      orderedProjectIds.push(item.project.id)
    }

    initialEntries.push({
      taskId: item.id,
      projectId: item.project.id,
      sortOrder: item.sortOrder ?? null,
    })
  })

  // Deep-linked task outside the assigned set: resolve its project by id so
  // the sheet opens in edit mode instead of silently creating a duplicate.
  let resolvedActiveTaskId: string | null = null

  if (activeTaskId && UUID_PATTERN.test(activeTaskId)) {
    const holdingProjectId = await getActiveTaskProjectId(activeTaskId)
    if (holdingProjectId) {
      resolvedActiveTaskId = activeTaskId
      if (!includedProjectIds.has(holdingProjectId)) {
        includedProjectIds.add(holdingProjectId)
        orderedProjectIds.push(holdingProjectId)
      }
    }
  }

  // Hydrate the task graph for only the projects that hold assigned (or
  // deep-linked) tasks — previously this loaded every project in the DB.
  const hydratedProjects = await fetchProjectsWithRelationsByIds(
    orderedProjectIds
  )
  const hydratedById = new Map(
    hydratedProjects.map(project => [project.id, project])
  )
  const relevantProjects = orderedProjectIds
    .map(id => hydratedById.get(id))
    .filter((project): project is NonNullable<typeof project> =>
      Boolean(project)
    )

  const selectionProjects = liteProjects.filter(
    project => !project.deleted_at
  )

  return (
    <MyTasksPage
      user={user}
      admins={admins}
      projects={relevantProjects}
      projectSelectionProjects={selectionProjects}
      initialEntries={initialEntries}
      activeTaskId={resolvedActiveTaskId}
      view={viewParam}
      selectedAssigneeId={selectedAssigneeId}
      now={now}
      initialOlderDoneCount={assignedSummaries.olderDoneCount}
    />
  )
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isMyTasksView(value: string): value is MyTasksView {
  return value === 'board' || value === 'calendar'
}

