import type { Metadata } from 'next'

import { requireRole } from '@/lib/auth/session'
import { fetchInvoicesForDashboard } from '@/lib/data/invoices'
import { fetchCachedBillingSettings } from '@/lib/data/billing-settings'
import { fetchActiveClients } from '@/lib/queries/clients'

import { InvoicesContent } from './_components/invoices-content'

export const metadata: Metadata = {
  title: 'Invoices',
}

export default async function InvoicesPage() {
  await requireRole('ADMIN')

  const [invoices, billingSettings, clients] = await Promise.all([
    fetchInvoicesForDashboard(),
    fetchCachedBillingSettings(),
    fetchActiveClients(),
  ])

  const clientOptions = clients.map(c => ({
    id: c.id,
    name: c.name,
    billingType: c.billingType,
  }))

  return (
    <InvoicesContent
      invoices={invoices}
      clients={clientOptions}
      billingSettings={billingSettings}
    />
  )
}
