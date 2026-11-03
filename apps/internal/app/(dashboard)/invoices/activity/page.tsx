import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'
import { INVOICES_TABS } from '../_lib/tabs'
import { hasClientDirectory } from '@/lib/queries/companies/billing'
import { InvoicesAddButton } from '../_components/invoices-add-button'
import { EntityActivityPage } from '@/components/activity/entity-activity-page'

export const metadata: Metadata = {
  title: 'Invoice activity',
}

export default async function InvoicesActivityPage() {
  await requirePage('activity.read_all')
  const hasClients = await hasClientDirectory()

  return (
    <EntityActivityPage
      navHref='/invoices'
      tabs={INVOICES_TABS}
      primaryAction={<InvoicesAddButton hasClients={hasClients} />}
      targetType='INVOICE'
      emptyState='No recent invoice activity.'
      description='Audit invoice creation, edits, sends, voids, and deletions in one place.'
    />
  )
}
