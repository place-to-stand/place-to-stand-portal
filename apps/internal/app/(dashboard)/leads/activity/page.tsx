import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requirePage } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'

import { LEADS_TABS } from '../_lib/tabs'
import { ActivitySection } from '@/components/activity/activity-section'
import { PagePanel } from '@/components/layout/page-panel'

export const metadata: Metadata = {
  title: 'Lead activity',
}

export default async function LeadsActivityPage() {
  const user = await requirePage('activity.read_crm')
  assertCrmAccess(user)

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Activity' }]}
      tabs={LEADS_TABS}
      activeTab='activity'
      primaryAction={<SheetCreateButton entity='lead' label='Create lead' />}
    >
      <PagePanel>
        <ActivitySection
          targetType='LEAD'
          emptyState='No recent lead activity.'
          description='Audit lead creation, edits, archives, and deletions in one place.'
        />
      </PagePanel>
    </PageShell>
  )
}
