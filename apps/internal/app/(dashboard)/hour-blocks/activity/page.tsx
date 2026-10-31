import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listHourBlocksForSettings } from '@/lib/queries/hour-blocks'

import { HourBlocksAddButton } from '../_components/hour-blocks-add-button'
import { ActivitySection } from '@/components/activity/activity-section'
import { HOUR_BLOCKS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Hour block activity',
}

export default async function HourBlocksActivityPage() {
  const currentUser = await requireRole('ADMIN')

  const { clients } = await listHourBlocksForSettings(currentUser, {
    status: 'active',
    limit: 1,
  })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/hour-blocks'), { label: 'Activity' }]}
      tabs={HOUR_BLOCKS_TABS}
      activeTab='activity'
      primaryAction={<HourBlocksAddButton clients={clients} />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ActivitySection
          targetType='HOUR_BLOCK'
          emptyState='No recent hour block activity.'
          description='Audit hour block creation, edits, archives, and deletions in one place.'
        />
      </section>
    </PageShell>
  )
}
