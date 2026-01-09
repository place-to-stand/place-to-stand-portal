import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listUsersForSettings } from '@/lib/queries/users'
import type { DbUser } from '@/lib/types'

import { UsersTabsNav } from '../_components/users-tabs-nav'
import { UsersAddButton } from '../_components/users-add-button'
import { UsersManagementTable } from '../_components/users-management-table'

export const metadata: Metadata = {
  title: 'User Archive | Settings',
}

type UsersArchivePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function UsersArchivePage({
  searchParams,
}: UsersArchivePageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}

  const cursor =
    typeof params.cursor === 'string'
      ? params.cursor
      : Array.isArray(params.cursor)
        ? (params.cursor[0] ?? null)
        : null
  const directionParam =
    typeof params.dir === 'string'
      ? params.dir
      : Array.isArray(params.dir)
        ? (params.dir[0] ?? null)
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

  const { items, assignments, totalCount, pageInfo } =
    await listUsersForSettings(currentUser, {
      status: 'archived',
      cursor,
      direction,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    })

  const users: DbUser[] = items.map(user => ({
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    avatar_url: user.avatarUrl,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    deleted_at: user.deletedAt,
  }))

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Users</h1>
          <p className='text-muted-foreground text-sm'>
            Review archived users and restore them when needed.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <UsersTabsNav activeTab='archive' className='flex-1 sm:flex-none' />
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
            <span className='text-muted-foreground text-sm whitespace-nowrap'>
              Total archived: {totalCount}
            </span>
            <UsersAddButton
              currentUserId={currentUser.id}
              assignments={assignments}
            />
          </div>
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <UsersManagementTable
            users={users}
            currentUserId={currentUser.id}
            assignments={assignments}
            pageInfo={pageInfo}
            mode='archive'
          />
        </section>
      </div>
    </>
  )
}
