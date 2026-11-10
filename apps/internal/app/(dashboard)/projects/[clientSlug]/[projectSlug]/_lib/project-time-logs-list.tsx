import 'server-only'

import { PagePanel } from '@/components/layout/page-panel'
import { fetchTimeLogPage } from '@/lib/data/dashboard/hours'
import { fetchAdminUsers } from '@/lib/data/users'
import { readPageSize } from '@/lib/pagination/page-size.server'
import { parseTimeLogsSearchParams } from '@/lib/time-logs/filters'

import { TimeLogsFilters } from '../../../../time-logs/_components/time-logs-filters'
import { TimeLogsTable } from '../../../../time-logs/_components/time-logs-table'

type SearchParams = Record<string, string | string[] | undefined>

/**
 * A project's Time logs tab: the Time logs list itself, held to this project.
 * Same table, footer total, sorting, paging, right-click menu and bulk bar;
 * the filters drop Client and Project, which the page already fixes.
 */
export async function ProjectTimeLogsList({
  projectId,
  basePath,
  searchParams,
}: {
  projectId: string
  /** This tab's path, which the filters, sort and pages write to. */
  basePath: string
  searchParams: SearchParams
}) {
  const params = parseTimeLogsSearchParams(searchParams)
  const pageSize = await readPageSize()
  const [page, admins] = await Promise.all([
    fetchTimeLogPage({
      search: params.q,
      from: params.from || undefined,
      to: params.to || undefined,
      projectId,
      userId: params.personId,
      limit: pageSize,
      offset: (params.page - 1) * pageSize,
      archived: false,
      sort: params.sort,
    }),
    fetchAdminUsers(),
  ])
  const people = admins.map(admin => ({
    value: admin.id,
    label: admin.full_name ?? admin.email,
    userId: admin.id,
    avatarUrl: admin.avatar_url,
  }))

  return (
    <PagePanel className='space-y-4'>
      <TimeLogsFilters basePath={basePath} params={params} people={people} />
      <TimeLogsTable
        items={page.items}
        totalCount={page.totalCount}
        totalHours={page.totalHours}
        currentPage={params.page}
        pageSize={pageSize}
        sort={params.sortParam}
        basePath={basePath}
      />
    </PagePanel>
  )
}
