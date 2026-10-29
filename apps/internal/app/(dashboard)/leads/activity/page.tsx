import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireCrmUser } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'

import { LEADS_TABS } from '../_lib/tabs'
import { ActivitySection } from '@/components/activity/activity-section'

export const metadata: Metadata = {
  title: 'Lead activity',
}

export default async function LeadsActivityPage() {
  const user = await requireCrmUser()
  assertCrmAccess(user)

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Activity' }]}
      tabs={LEADS_TABS}
      activeTab='activity'
    >
      <section className='bg-background space-y-3 rounded-xl border p-4 shadow-sm'>
        <div>
          <h3 className='text-lg font-semibold'>Recent activity</h3>
          <p className='text-muted-foreground text-sm'>
            Audit lead creation, edits, archives, and status changes in one
            place.
          </p>
        </div>
        <ActivitySection
          targetType='LEAD'
          emptyState='No recent lead activity.'
        />
      </section>
    </PageShell>
  )
}
