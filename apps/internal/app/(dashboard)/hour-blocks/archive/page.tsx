import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listHourBlocksForSettings } from '@/lib/queries/hour-blocks'
import { parseHourBlocksSearchParams } from '@/lib/settings/hour-blocks/filters'

import { HourBlocksAddButton } from '../_components/hour-blocks-add-button'
import { HourBlocksFilters } from '../_components/hour-blocks-filters'
import { HourBlocksManagementTable } from '../_components/hour-blocks-management-table'
import { HOUR_BLOCKS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Hour Blocks Archive | Settings',
}

const PAGE_SIZE = 20

type HourBlocksArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function HourBlocksArchivePage({
  searchParams,
}: HourBlocksArchivePageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}

  const { page: currentPage, search, sort } = parseHourBlocksSearchParams(params)
  const offset = (currentPage - 1) * PAGE_SIZE

  const { items, clients, totalCount, unfilteredTotalCount } =
    await listHourBlocksForSettings(currentUser, {
      status: 'archived',
      offset,
      limit: PAGE_SIZE,
      search,
      sort,
    })

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/hour-blocks'), { label: 'Archive' }]}
      tabs={HOUR_BLOCKS_TABS}
      activeTab='archive'
      count={{
        label: 'archived hour blocks',
        total: unfilteredTotalCount,
        filteredTotal: totalCount,
      }}
      primaryAction={<HourBlocksAddButton clients={clients} />}
    >
      <section className='bg-background space-y-4 rounded-xl border p-6 shadow-sm'>
        <HourBlocksFilters basePath='/hour-blocks/archive' search={search} />
        <HourBlocksManagementTable
          hourBlocks={items}
          clients={clients}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          mode='archive'
          basePath='/hour-blocks/archive'
        />
      </section>
    </PageShell>
  )
}
