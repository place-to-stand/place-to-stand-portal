import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listHourBlocksForSettings } from '@/lib/queries/hour-blocks'

import { HourBlocksAddButton } from './_components/hour-blocks-add-button'
import { HourBlocksManagementTable } from './_components/hour-blocks-management-table'
import { HOUR_BLOCKS_TABS } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Hour Blocks | Settings',
}

const PAGE_SIZE = 20

type HourBlocksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function HourBlocksPage({
  searchParams,
}: HourBlocksPageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}

  const pageParam =
    typeof params.page === 'string'
      ? params.page
      : Array.isArray(params.page)
        ? params.page[0] ?? '1'
        : '1'
  const currentPage = Math.max(1, Number.parseInt(pageParam, 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const { items, clients, totalCount } =
    await listHourBlocksForSettings(currentUser, {
      status: 'active',
      offset,
      limit: PAGE_SIZE,
    })

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/hour-blocks')}
      tabs={HOUR_BLOCKS_TABS}
      activeTab='hour-blocks'
      count={{ label: 'hour blocks', total: totalCount }}
      primaryAction={<HourBlocksAddButton clients={clients} />}
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <HourBlocksManagementTable
          hourBlocks={items}
          clients={clients}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          mode='active'
        />
      </section>
    </PageShell>
  )
}
