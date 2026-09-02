import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listHourBlocksForSettings } from '@/lib/queries/hour-blocks'

import { HourBlocksAddButton } from '../_components/hour-blocks-add-button'
import { HourBlocksActivitySection } from '../_components/hour-blocks-activity-section'
import { HOUR_BLOCKS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Hour Blocks Activity | Settings',
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function HourBlocksActivityContent() {
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
        <HourBlocksActivitySection />
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs) so only the content area pulses
// while data streams in. The add button needs the fetched client list, so it
// appears with the content.
function HourBlocksActivityPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/hour-blocks'), { label: 'Activity' }]}
      tabs={HOUR_BLOCKS_TABS}
      activeTab='activity'
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function HourBlocksActivityPage() {
  return (
    <Suspense fallback={<HourBlocksActivityPageFallback />}>
      <HourBlocksActivityContent />
    </Suspense>
  )
}
