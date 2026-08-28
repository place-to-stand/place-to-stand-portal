import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listAllProductCatalogItems } from '@/lib/queries/product-catalog'
import { listTaxRates } from '@/lib/queries/tax-rates'

import { INVOICES_TABS } from '../_lib/tabs'
import { ProductCatalogSection } from './_components/product-catalog-section'
import { TaxRatesSection } from './_components/tax-rates-section'

export const metadata: Metadata = {
  title: 'Invoice Settings',
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function InvoiceSettingsContent() {
  await requireRole('ADMIN')

  const [products, taxRates] = await Promise.all([
    listAllProductCatalogItems(),
    listTaxRates(),
  ])

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/invoices'), { label: 'Settings' }]}
      tabs={INVOICES_TABS}
      activeTab='settings'
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <div className='space-y-10'>
          <ProductCatalogSection initialItems={products} />
          <TaxRatesSection initialRates={taxRates} />
        </div>
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs) so only the content area pulses
// while data streams in.
function InvoiceSettingsPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/invoices'), { label: 'Settings' }]}
      tabs={INVOICES_TABS}
      activeTab='settings'
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function InvoiceSettingsPage() {
  return (
    <Suspense fallback={<InvoiceSettingsPageFallback />}>
      <InvoiceSettingsContent />
    </Suspense>
  )
}
