import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'
import { HOUR_BLOCKS_TABS } from '../_lib/tabs'
import { hasClientDirectory } from '@/lib/queries/companies/billing'
import { HourBlocksAddButton } from '../_components/hour-blocks-add-button'
import { EntityActivityPage } from '@/components/activity/entity-activity-page'

export const metadata: Metadata = {
  title: 'Hour block activity',
}

export default async function HourBlocksActivityPage() {
  await requirePage('activity.read_all')
  const hasClients = await hasClientDirectory()

  return (
    <EntityActivityPage
      navHref='/hour-blocks'
      tabs={HOUR_BLOCKS_TABS}
      primaryAction={<HourBlocksAddButton hasClients={hasClients} />}
      targetType='HOUR_BLOCK'
      emptyState='No recent hour block activity.'
      description='Audit hour block creation, edits, archives, and deletions in one place.'
    />
  )
}
