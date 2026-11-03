import type { Metadata } from 'next'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { requirePage } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { LEADS_TABS } from '../_lib/tabs'
import { EntityActivityPage } from '@/components/activity/entity-activity-page'

export const metadata: Metadata = {
  title: 'Lead activity',
}

export default async function LeadsActivityPage() {
  const user = await requirePage('activity.read_crm')
  assertCrmAccess(user)

  return (
    <EntityActivityPage
      navHref='/leads'
      tabs={LEADS_TABS}
      primaryAction={<SheetCreateButton entity='lead' label='Create lead' />}
      targetType='LEAD'
      emptyState='No recent lead activity.'
      description='Audit lead creation, edits, archives, and deletions in one place.'
    />
  )
}
