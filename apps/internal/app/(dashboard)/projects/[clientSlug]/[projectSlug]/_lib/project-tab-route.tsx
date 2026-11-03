import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { ReactElement } from 'react'

import { ProjectsBoard } from '../../../projects-board'
import {
  fetchProjectsLite,
  fetchProjectsWithRelationsByIds,
} from '@/lib/data/projects'
import { fetchAdminUsers, fetchCrmUsers } from '@/lib/data/users'
import { requirePage } from '@/lib/auth/session'
import { scopeProjectsForViewer } from '@/lib/projects/viewer-scope'
import { getProjectClientSegment } from '@/lib/projects/board/board-utils'
import { buildQuerySuffix } from '@/lib/sheets/hrefs'
import { listClientDirectory } from '@/lib/queries/companies/billing'
import type { ClientPickerRow } from '@/lib/projects/sheet/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/projects/sheet/project-sheet-ui-state'
import { roleCan } from '@/lib/auth/capabilities'

export const projectTabMetadata: Metadata = {
  title: 'Projects',
}

/** Each project tab: its URL segment and the board tab it opens. */
const TABS = {
  board: { segment: 'tasks' },
  review: { segment: 'review' },
  activity: { segment: 'activity' },
  timeLogs: { segment: 'time-logs' },
} as const

export type ProjectTab = keyof typeof TABS

type ProjectTabRouteArgs = {
  tab: ProjectTab
  params: Promise<{ clientSlug: string; projectSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type LiteProjects = Awaited<ReturnType<typeof fetchProjectsLite>>

const buildClientList = (projects: LiteProjects) =>
  projects
    .map(project => project.client)
    .filter((client): client is NonNullable<typeof client> => Boolean(client))
    .reduce(
      (acc, client) => {
        if (!acc.some(existing => existing.id === client.id)) {
          acc.push({ id: client.id, name: client.name, slug: client.slug })
        }
        return acc
      },
      [] as Array<{ id: string; name: string; slug: string | null }>
    )
    .sort((a, b) => a.name.localeCompare(b.name))

/**
 * The one loader for the project workspace tabs. The board (`tasks`) is open
 * to project members, who see only their projects and no billing; the other
 * tabs are admin-only. Only the active project gets its task graph hydrated,
 * after the canonical-slug redirect, so a redirect stays cheap.
 */
export async function renderProjectTabRoute({
  tab,
  params,
  searchParams,
}: ProjectTabRouteArgs): Promise<ReactElement> {
  const [{ clientSlug, projectSlug }, query] = await Promise.all([
    params,
    searchParams,
  ])
  const isBoard = tab === 'board'
  const user = await requirePage(
    isBoard ? 'projects.view_member' : 'projects.admin_tabs'
  )
  const isAdmin = roleCan(user.role, 'projects.manage')

  const [allLiteProjects, admins, boardAssignees, clientDirectory] =
    await Promise.all([
      fetchProjectsLite(),
      isAdmin ? fetchAdminUsers() : Promise.resolve([]),
      isBoard ? fetchCrmUsers() : Promise.resolve(null),
      isAdmin ? listClientDirectory() : Promise.resolve([]),
    ])
  const liteProjects = isBoard
    ? await scopeProjectsForViewer(user, allLiteProjects)
    : allLiteProjects

  const allClients: ClientPickerRow[] = clientDirectory.map(c => ({
    id: c.id,
    name: c.name,
    deleted_at: c.deletedAt,
  }))
  const clients = buildClientList(liteProjects)
  const clientSlugById = new Map<string, string | null>(
    clients.map(client => [client.id, client.slug ?? null])
  )
  const adminUsers: AdminUserForOwner[] = admins.map(admin => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    avatar_url: admin.avatar_url,
    disabled_at: admin.disabled_at ?? null,
  }))

  const project = liteProjects.find(item => item.slug === projectSlug)
  if (!project) {
    redirect('/projects')
  }

  const canonicalClientSlug = getProjectClientSegment(project, clientSlugById)
  if (!canonicalClientSlug) {
    redirect('/projects')
  }

  if (canonicalClientSlug !== clientSlug) {
    // Carry the whole query string so a stacked sheet link survives it.
    redirect(
      `/projects/${canonicalClientSlug}/${project.slug}/${TABS[tab].segment}${buildQuerySuffix(query)}`
    )
  }

  // Review lists archived tasks, so it hydrates them too.
  const hydrated = await fetchProjectsWithRelationsByIds([project.id], {
    includeArchivedTasks: tab === 'review',
  })
  const [hydratedProject] = isBoard
    ? await scopeProjectsForViewer(user, hydrated)
    : hydrated
  const projects = liteProjects.map(item =>
    item.id === project.id && hydratedProject ? hydratedProject : item
  )

  return (
    <ProjectsBoard
      projects={projects}
      clients={clients}
      currentUserId={user.id}
      admins={boardAssignees ?? admins}
      adminUsers={adminUsers}
      allClients={allClients}
      activeClientId={project.company_id ?? null}
      activeProjectId={project.id}
      initialTab={tab}
      // Server-rendered anchor for the Done column's rolling window, so SSR
      // and hydration measure the cutoff from the same instant.
      now={isBoard ? new Date().toISOString() : undefined}
    />
  )
}
