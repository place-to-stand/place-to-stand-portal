import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listInvoices } from '@/lib/queries/invoices'

import { InvoicesAddButton } from '../_components/invoices-add-button'
import { ActivitySection } from '@/components/activity/activity-section'
import { INVOICES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Invoice activity',
}

export default async function InvoicesActivityPage() {
  const currentUser = await requireRole('ADMIN')

  const { clients } = await listInvoices(currentUser, {
    status: 'active',
    limit: 1,
  })

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/invoices'), { label: 'Activity' }]}
      tabs={INVOICES_TABS}
      activeTab='activity'
      primaryAction={<InvoicesAddButton clients={clients} />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ActivitySection
          targetType='INVOICE'
          emptyState='No recent invoice activity.'
          description='Audit invoice creation, edits, sends, voids, and deletions in one place.'
        />
      </section>
    </PageShell>
  )
}
