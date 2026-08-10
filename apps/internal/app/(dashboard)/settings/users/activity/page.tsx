import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listUsersForSettings } from '@/lib/queries/users'

import { UsersAddButton } from '../_components/users-add-button'
import { UsersActivitySection } from '../_components/users-activity-section'
import { USERS_TABS } from '../_lib/tabs'

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
    <PageShell
      breadcrumbs={[...crumbsForNav('/settings/users'), { label: 'Activity' }]}
      tabs={USERS_TABS}
      activeTab='activity'
      primaryAction={
        <UsersAddButton
          currentUserId={currentUser.id}
          assignments={assignments}
        />
      }
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <UsersActivitySection />
      </section>
    </PageShell>
  )
}
