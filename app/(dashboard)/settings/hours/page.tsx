import type { Metadata } from 'next'

import { HourBlocksSettingsTable } from './hour-blocks-table'
import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listHourBlocksForSettings } from '@/lib/queries/hour-blocks'
import { listTimeLogsForAdmin } from '@/lib/queries/time-logs/admin'

export const metadata: Metadata = {
  title: 'Hours | Settings',
}

type HoursSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type HoursTab = 'hour-blocks' | 'hours-logged' | 'archive' | 'activity'

export default async function HoursSettingsPage({
  searchParams,
}: HoursSettingsPageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const tabParamRaw = params.tab
  const tabParam =
    typeof tabParamRaw === 'string'
      ? tabParamRaw
      : Array.isArray(tabParamRaw)
        ? tabParamRaw[0]
        : 'hour-blocks'

  const tab: HoursTab =
    tabParam === 'hours-logged'
      ? 'hours-logged'
      : tabParam === 'archive'
        ? 'archive'
        : tabParam === 'activity'
          ? 'activity'
          : 'hour-blocks'

  const status = tab === 'archive' ? 'archived' : 'active'
  const searchQuery =
    typeof params.q === 'string'
      ? params.q
      : Array.isArray(params.q)
        ? params.q[0] ?? ''
        : ''
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

  // Extract sortBy and sortDir for hours-logged tab
  const sortByParam =
    typeof params.sortBy === 'string'
      ? params.sortBy
      : Array.isArray(params.sortBy)
        ? params.sortBy[0]
        : undefined
  const sortBy: 'user' | 'project' | 'date' | 'hours' =
    sortByParam === 'user' ||
    sortByParam === 'project' ||
    sortByParam === 'hours'
      ? sortByParam
      : 'date'

  const sortDirParam =
    typeof params.sortDir === 'string'
      ? params.sortDir
      : Array.isArray(params.sortDir)
        ? params.sortDir[0]
        : undefined
  const sortDir: 'asc' | 'desc' =
    sortDirParam === 'asc' ? 'asc' : 'desc'

  // Fetch hour blocks data
  const { items, clients, totalCount, pageInfo } =
    await listHourBlocksForSettings(currentUser, {
      status,
      search: searchQuery,
      cursor,
      direction,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    })

  // Fetch hours logged data if on that tab
  let hoursLoggedData: Awaited<ReturnType<typeof listTimeLogsForAdmin>> | null = null
  if (tab === 'hours-logged') {
    try {
      hoursLoggedData = await listTimeLogsForAdmin(currentUser, {
        sortBy,
        sortDir,
        cursor,
        direction,
        limit: Number.isFinite(limitParam) ? limitParam : undefined,
      })
    } catch (error) {
      console.error('Error fetching hours logged data:', error)
      // Return empty result on error
      hoursLoggedData = {
        items: [],
        totalCount: 0,
        pageInfo: {
          hasPreviousPage: false,
          hasNextPage: false,
          startCursor: null,
          endCursor: null,
        },
      }
    }
  }

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Hours</h1>
          <p className='text-muted-foreground text-sm'>
            Manage purchased hour blocks and view time logs across all projects.
          </p>
        </div>
      </AppShellHeader>
      <HourBlocksSettingsTable
        hourBlocks={items}
        clients={clients}
        tab={tab}
        pageInfo={pageInfo}
        totalCount={totalCount}
        hoursLoggedData={hoursLoggedData}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </>
  )
}
