import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
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
      primaryAction={<SheetCreateButton entity='lead' label='Add lead' />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ActivitySection
          targetType='LEAD'
          emptyState='No recent lead activity.'
          description='Audit lead creation, edits, archives, and deletions in one place.'
        />
      </section>
    </PageShell>
  )
}
