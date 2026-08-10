import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listUsersForSettings } from '@/lib/queries/users'
import { parseUsersSearchParams } from '@/lib/settings/users/filters'
import type { DbUser } from '@/lib/types'

import { UsersAddButton } from './_components/users-add-button'
import { UsersFilters } from './_components/users-filters'
import { UsersManagementTable } from './_components/users-management-table'
import { USERS_TABS } from './_lib/tabs'

export const metadata: Metadata = {
  title: 'Users | Settings',
}

type UsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function UsersPage({
  searchParams,
}: UsersPageProps) {
  const currentUser = await requireRole('ADMIN')
  const params = searchParams ? await searchParams : {}
  const { page, limit, role, access, search, sort } =
    parseUsersSearchParams(params)

  const {
    items,
    assignments,
    totalCount,
    unfilteredTotalCount,
    page: servedPage,
    pageSize,
    totalPages,
  } = await listUsersForSettings(currentUser, {
    status: 'active',
    page,
    limit,
    role,
    access,
    search,
    sort,
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
    disabled_at: user.disabledAt,
  }))

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/settings/users')}
      tabs={USERS_TABS}
      activeTab='users'
      count={{ label: 'users', total: unfilteredTotalCount, filteredTotal: totalCount }}
      primaryAction={
        <UsersAddButton
          currentUserId={currentUser.id}
          assignments={assignments}
        />
      }
    >
      <section className='bg-background space-y-4 rounded-xl border p-4 shadow-sm'>
        <UsersFilters
          basePath='/settings/users'
          role={role}
          access={access}
          search={search}
          showAccessFilter
        />
        <UsersManagementTable
          users={users}
          currentUserId={currentUser.id}
          assignments={assignments}
          page={servedPage}
          pageSize={pageSize}
          totalPages={totalPages}
          totalCount={totalCount}
          mode='active'
          basePath='/settings/users'
        />
      </section>
    </PageShell>
  )
}
