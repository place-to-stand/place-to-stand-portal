import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listHourBlocksForSettings } from '@/lib/queries/hour-blocks'

import { HourBlocksTabsNav } from '../_components/hour-blocks-tabs-nav'
import { HourBlocksAddButton } from '../_components/hour-blocks-add-button'
import { HourBlocksManagementTable } from '../_components/hour-blocks-management-table'

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
      status: 'archived',
      offset,
      limit: PAGE_SIZE,
    })

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Hour Blocks</h1>
          <p className='text-muted-foreground text-sm'>
            Review archived hour blocks and restore them when needed.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <HourBlocksTabsNav activeTab='archive' className='flex-1 sm:flex-none' />
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
            <span className='text-muted-foreground text-sm whitespace-nowrap'>
              Total archived: {totalCount}
            </span>
            <HourBlocksAddButton clients={clients} />
          </div>
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <HourBlocksManagementTable
            hourBlocks={items}
            clients={clients}
            totalCount={totalCount}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            mode='archive'
          />
        </section>
      </div>
    </>
  )
}
