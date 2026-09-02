import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { ProjectsBoard } from '../../../projects-board'
import {
  fetchProjectsLite,
  fetchProjectsWithRelationsByIds,
} from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import { requireUser } from '@/lib/auth/session'
import { getProjectClientSegment } from '@/lib/projects/board/board-utils'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { buildQuerySuffix } from '@/lib/sheets/hrefs'
import { fetchClientDirectory } from '@/lib/queries/clients'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'

export const metadata: Metadata = {
  title: 'Projects | Place to Stand Portal',
}

type PageProps = {
  params: Promise<{
    clientSlug: string
    projectSlug: string
  }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function ProjectBoardContent({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const { clientSlug, projectSlug } = resolvedParams
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const taskParam = firstParam(resolvedSearchParams.task) ?? null
  const user = await requireUser()
  // Lite list feeds the switcher and sheet selectors; only the active
  // project (resolved below) gets its task graph hydrated.
  const [liteProjects, admins, clientDirectory] = await Promise.all([
    fetchProjectsLite(),
    fetchAdminUsers(),
    fetchClientDirectory(),
  ])

  const allClients: ClientRow[] = clientDirectory.map(c => ({
    id: c.id,
    name: c.name,
    deleted_at: c.deletedAt,
  }))

  const clients = liteProjects
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

  const clientSlugById = new Map<string, string | null>(
    clients.map(client => [client.id, client.slug ?? null])
  )

  const adminUsers: AdminUserForOwner[] = admins.map(admin => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    avatar_url: admin.avatar_url,
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
    // Carry the whole query string across the canonical redirect so a
    // stacked sheet link (`?task=x&client=y`) survives it.
    redirect(
      `/projects/${canonicalClientSlug}/${project.slug}/tasks${buildQuerySuffix(resolvedSearchParams)}`
    )
  }

  const activeClientId = project.client_id ?? null
  const activeProjectId = project.id
  const activeTaskId = taskParam && UUID_PATTERN.test(taskParam) ? taskParam : null

  // Hydrate the task graph for the active project only (after the
  // canonical-slug redirects above, so redirects stay cheap).
  const [hydratedProject] = await fetchProjectsWithRelationsByIds([project.id])
  const projects = liteProjects.map(item =>
    item.id === project.id && hydratedProject ? hydratedProject : item
  )

  return (
    <ProjectsBoard
      projects={projects}
      clients={clients}
      currentUserId={user.id}
      admins={admins}
      adminUsers={adminUsers}
      allClients={allClients}
      activeClientId={activeClientId}
      activeProjectId={activeProjectId}
      activeTaskId={activeTaskId}
      initialTab='board'
      // Server-rendered anchor for the Done column's rolling window, so SSR
      // and hydration measure the cutoff from the same instant.
      now={new Date().toISOString()}
    />
  )
}

// Static portion of the board chrome only — the project-name breadcrumb and
// burndown widget depend on fetched data, so the fallback shows the base
// crumb with a pulsing board area (mirrors ProjectsBoard's PageShell).
function ProjectBoardFallback() {
  return (
    <PageShell
      breadcrumbs={crumbsForNav('/projects')}
      contentClassName='flex h-full min-h-0 flex-col gap-4 sm:gap-6'
    >
      <section className='bg-background flex-1 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function ProjectBoardRoute({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<ProjectBoardFallback />}>
      <ProjectBoardContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}
