import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { ProjectsManagementSection } from '../_components/projects-management-section'
import { mapProjectToTableRow } from '../_lib/map-project-to-table-row'
import { parseProjectsSearchParams } from '../_lib/parse-projects-search-params'
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

export default async function ProjectsArchivePage({
  searchParams,
}: ProjectsArchivePageProps) {
  const admin = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const { searchQuery, cursor, direction, limit } = parseProjectsSearchParams(params)

  const [archiveResult, adminUsersResult] = await Promise.all([
    listProjectsForSettings(admin, {
      status: 'archived',
      search: searchQuery ?? '',
      cursor,
      direction,
      limit,
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
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Projects</h1>
          <p className='text-muted-foreground text-sm'>
            Review archived projects and restore them when work resumes.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-6'>
        <ProjectsManagementSection
          tab='archive'
          mode='archive'
          projects={hydratedProjects}
          clients={clientRows}
          adminUsers={adminUsers}
          contractorUsers={[]}
          membersByProject={{}}
          pageInfo={archiveResult.pageInfo}
          listTotalCount={archiveResult.totalCount}
        />
      </div>
    </>
  )
}
