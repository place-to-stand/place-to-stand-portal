import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listUsersForSettings } from '@/lib/queries/users'

import { UsersTabsNav } from '../_components/users-tabs-nav'
import { UsersAddButton } from '../_components/users-add-button'
import { UsersActivitySection } from '../_components/users-activity-section'

export const metadata: Metadata = {
  title: 'User Activity | Settings',
}

export default async function UsersActivityPage() {
  const currentUser = await requireRole('ADMIN')

  const { assignments } = await listUsersForSettings(currentUser, {
    status: 'active',
    limit: 1,
  })

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Users</h1>
          <p className='text-muted-foreground text-sm'>
            Review user activity to keep audit history clear.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <UsersTabsNav activeTab='activity' className='flex-1 sm:flex-none' />
          <UsersAddButton
            currentUserId={currentUser.id}
            assignments={assignments}
          />
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <UsersActivitySection />
        </section>
      </div>
    </>
  )
}
