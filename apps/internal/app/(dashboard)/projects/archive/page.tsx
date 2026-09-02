import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { ProjectsArchiveFilters } from '../_components/projects-archive-filters'
import { ProjectsManagementSection } from '../_components/projects-management-section'
import { ProjectsAddButton } from '../_components/projects-add-button'
import { mapProjectToTableRow } from '../_lib/map-project-to-table-row'
import { parseProjectsSearchParams } from '../_lib/parse-projects-search-params'
import { PROJECTS_TABS } from '../_lib/tabs'
import { fetchAdminUsers } from '@/lib/data/users'
import { requireRole } from '@/lib/auth/session'
import { listProjectsForSettings } from '@/lib/queries/projects'
import type {
  ClientRow,
  ProjectWithClient,
} from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'

export const metadata: Metadata = {
  title: 'Project Archive | Place to Stand Portal',
}

type ProjectsArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function ProjectsArchiveContent({
  searchParams,
}: ProjectsArchivePageProps) {
  const admin = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const { searchQuery, cursor, direction, limit, sort } =
    parseProjectsSearchParams(params)

  const [archiveResult, adminUsersResult] = await Promise.all([
    listProjectsForSettings(admin, {
      status: 'archived',
      search: searchQuery ?? '',
      cursor,
      direction,
      limit,
      sort,
    }),
    fetchAdminUsers(),
  ])

  const adminUsers: AdminUserForOwner[] = adminUsersResult.map(admin => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    avatar_url: admin.avatar_url,
  }))

  const clientRows: ClientRow[] = archiveResult.clients.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))

  const hydratedProjects: ProjectWithClient[] =
    archiveResult.items.map(mapProjectToTableRow)

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/projects'), { label: 'Archive' }]}
      tabs={PROJECTS_TABS}
      activeTab='archive'
      count={{
        label: 'archived projects',
        total: archiveResult.unfilteredTotalCount,
        filteredTotal: archiveResult.totalCount,
      }}
      primaryAction={<ProjectsAddButton clients={clientRows} />}
    >
      <ProjectsManagementSection
        mode='archive'
        projects={hydratedProjects}
        clients={clientRows}
        adminUsers={adminUsers}
        contractorUsers={[]}
        membersByProject={{}}
        pageInfo={archiveResult.pageInfo}
        filters={
          <ProjectsArchiveFilters search={searchQuery ?? undefined} />
        }
      />
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs · add button) so only the
// table area pulses while data streams in — the count chip appears with it.
function ProjectsArchivePageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/projects'), { label: 'Archive' }]}
      tabs={PROJECTS_TABS}
      activeTab='archive'
      primaryAction={<ProjectsAddButton clients={[]} />}
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function ProjectsArchivePage({
  searchParams,
}: ProjectsArchivePageProps) {
  return (
    <Suspense fallback={<ProjectsArchivePageFallback />}>
      <ProjectsArchiveContent searchParams={searchParams} />
    </Suspense>
  )
}
