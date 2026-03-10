import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listInvoices } from '@/lib/queries/invoices'

import { InvoicesTabsNav } from '../_components/invoices-tabs-nav'
import { InvoicesAddButton } from '../_components/invoices-add-button'
import { InvoicesActivitySection } from '../_components/invoices-activity-section'

export const metadata: Metadata = {
  title: 'Invoices Activity',
}

export default async function InvoicesActivityPage() {
  const currentUser = await requireRole('ADMIN')

  const { clients, productCatalog } = await listInvoices(currentUser, {
    status: 'active',
    limit: 1,
  })

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Invoices</h1>
          <p className='text-muted-foreground text-sm'>
            Review invoice activity to keep audit history clear.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <InvoicesTabsNav activeTab='activity' className='flex-1 sm:flex-none' />
          <InvoicesAddButton clients={clients} productCatalog={productCatalog} />
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <InvoicesActivitySection />
        </section>
      </div>
    </>
  )
}
