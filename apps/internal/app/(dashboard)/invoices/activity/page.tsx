import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listInvoices } from '@/lib/queries/invoices'

import { InvoicesAddButton } from '../_components/invoices-add-button'
import { InvoicesActivitySection } from '../_components/invoices-activity-section'
import { INVOICES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Invoices Activity',
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function InvoicesActivityContent() {
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
        <InvoicesActivitySection />
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs) so only the content area pulses
// while data streams in. The add button needs the fetched client list, so it
// appears with the content.
function InvoicesActivityPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/invoices'), { label: 'Activity' }]}
      tabs={INVOICES_TABS}
      activeTab='activity'
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function InvoicesActivityPage() {
  return (
    <Suspense fallback={<InvoicesActivityPageFallback />}>
      <InvoicesActivityContent />
    </Suspense>
  )
}
