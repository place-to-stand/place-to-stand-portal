import 'server-only'

import { countTimeLogs, fetchTimeLogPage } from '@/lib/data/dashboard/hours'
import { fetchProjectsLite } from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import type { ProjectWithRelations } from '@/lib/types'
import { readPageSize } from '@/lib/pagination/page-size.server'
import { fetchClientDirectory } from '@/lib/queries/clients'
import { parseTimeLogsSearchParams } from '@/lib/time-logs/filters'

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Everything the Time logs list and its Archive tab render: one filtered
 * page of logs (live or archived) plus the filter options. Callers guard.
 */
export async function loadTimeLogsList(
  searchParams: SearchParams,
  { archived }: { archived: boolean }
) {
  const params = parseTimeLogsSearchParams(searchParams)
  const pageSize = await readPageSize()

  const [page, unfilteredTotal, clientDirectory, projects, admins] =
    await Promise.all([
      fetchTimeLogPage({
        from: params.from,
        to: params.to,
        clientId: params.clientId,
        projectId: params.projectId,
        userId: params.personId,
        limit: pageSize,
        offset: (params.page - 1) * pageSize,
        archived,
        sort: params.sort,
      }),
      countTimeLogs({ archived }),
      fetchClientDirectory(),
      fetchProjectsLite(),
      fetchAdminUsers(),
    ])

  const clients = clientDirectory
    .filter(client => !client.deletedAt)
    .map(client => ({ value: client.id, label: client.name }))
  const projectOptions = toProjectOptions(
    projects.filter(
      project => !params.clientId || project.company_id === params.clientId
    )
  )
  const people = admins.map(admin => ({
    value: admin.id,
    label: admin.full_name ?? admin.email,
    userId: admin.id,
    avatarUrl: admin.avatar_url,
  }))

  return {
    params,
    pageSize,
    page,
    unfilteredTotal,
    clients,
    projects: projectOptions,
    /** Every project, unfiltered: the Log time button's picker. */
    logTimeProjects: toProjectOptions(projects),
    people,
  }
}

function toProjectOptions(projects: ProjectWithRelations[]) {
  return projects.map(project => ({
    value: project.id,
    label: project.name,
    description: project.client?.name ?? undefined,
  }))
}

/** The Log time button's project options, for tabs without the list. */
export async function loadLogTimeProjects() {
  return toProjectOptions(await fetchProjectsLite())
}
