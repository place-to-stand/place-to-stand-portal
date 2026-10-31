import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { LogTimeButton } from '../_components/log-time-button'
import { TimeLogsFilters } from '../_components/time-logs-filters'
import { TimeLogsTable } from '../_components/time-logs-table'
import { loadTimeLogsList } from '../_lib/load-time-logs-list'
import { TIME_LOGS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Time log archive',
}

/** Archived (soft-deleted) time logs, filterable and restorable. Admin only. */
export default async function TimeLogsArchivePage({
  searchParams,
}: PageProps<'/time-logs/archive'>) {
  await requireRole('ADMIN')
  const {
    params,
    pageSize,
    page,
    unfilteredTotal,
    clients,
    projects,
    logTimeProjects,
    people,
  } = await loadTimeLogsList(await searchParams, { archived: true })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/time-logs'), { label: 'Archive' }]}
      tabs={TIME_LOGS_TABS}
      activeTab='archive'
      count={{
        label: 'archived time logs',
        total: unfilteredTotal,
        filteredTotal: page.totalCount,
      }}
      primaryAction={<LogTimeButton projects={logTimeProjects} />}
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <TimeLogsFilters
          basePath='/time-logs/archive'
          params={params}
          clients={clients}
          projects={projects}
          people={people}
        />
        <TimeLogsTable
          items={page.items}
          totalCount={page.totalCount}
          totalHours={page.totalHours}
          currentPage={params.page}
          pageSize={pageSize}
          sort={params.sortParam}
          mode='archive'
        />
      </section>
    </PageShell>
  )
}
