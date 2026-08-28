import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listInvoices } from '@/lib/queries/invoices'

import { InvoicesAddButton } from '../_components/invoices-add-button'
import { InvoicesActivitySection } from '../_components/invoices-activity-section'
import { INVOICES_TABS } from '../_lib/tabs'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = {
  title: 'Invoices Activity',
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
        <InvoicesActivitySection />
      </section>
    </PageShell>
  )
}
