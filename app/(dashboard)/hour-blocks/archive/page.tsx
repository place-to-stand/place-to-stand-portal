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

type HourBlocksArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function HourBlocksArchivePage({
  searchParams,
}: HourBlocksArchivePageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}

  const cursor =
    typeof params.cursor === 'string'
      ? params.cursor
      : Array.isArray(params.cursor)
        ? params.cursor[0] ?? null
        : null
  const directionParam =
    typeof params.dir === 'string'
      ? params.dir
      : Array.isArray(params.dir)
        ? params.dir[0] ?? null
        : null
  const direction =
    directionParam === 'backward' ? 'backward' : ('forward' as const)
  const limitParamRaw =
    typeof params.limit === 'string'
      ? params.limit
      : Array.isArray(params.limit)
        ? params.limit[0]
        : undefined
  const limitParam = Number.parseInt(limitParamRaw ?? '', 10)

  const { items, clients, totalCount, pageInfo } =
    await listHourBlocksForSettings(currentUser, {
      status: 'archived',
      cursor,
      direction,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    })

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
            pageInfo={pageInfo}
            mode='archive'
          />
        </section>
      </div>
    </>
  )
}
