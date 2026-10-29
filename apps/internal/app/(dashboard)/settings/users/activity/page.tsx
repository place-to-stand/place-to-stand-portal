import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { ActivitySection } from '@/components/activity/activity-section'
import { USERS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'User activity | Settings',
}

export default async function UsersActivityPage() {
  await requireRole('ADMIN')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/settings/users'), { label: 'Activity' }]}
      tabs={USERS_TABS}
      activeTab='activity'
      primaryAction={<SheetCreateButton entity='user' label='Add user' />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ActivitySection
          targetType='USER'
          emptyState='No recent user activity.'
          description='Audit user creation, edits, archives, and deletions in one place.'
        />
      </section>
    </PageShell>
  )
}
