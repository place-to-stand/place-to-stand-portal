import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listAllProductCatalogItems } from '@/lib/queries/product-catalog'
import { listTaxRates } from '@/lib/queries/tax-rates'

import { InvoicesTabsNav } from '../_components/invoices-tabs-nav'
import { ProductCatalogSection } from './_components/product-catalog-section'
import { TaxRatesSection } from './_components/tax-rates-section'

export const metadata: Metadata = {
  title: 'Invoice Settings',
}

export default async function InvoiceSettingsPage() {
  await requireRole('ADMIN')

  const [products, taxRates] = await Promise.all([
    listAllProductCatalogItems(),
    listTaxRates(),
  ])

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Invoices</h1>
          <p className='text-muted-foreground text-sm'>
            Manage product catalog and tax rates for invoicing.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <InvoicesTabsNav activeTab='settings' className='flex-1 sm:flex-none' />
        </div>
        {/* Settings Sections */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <div className='space-y-10'>
            <ProductCatalogSection initialItems={products} />
            <TaxRatesSection initialRates={taxRates} />
          </div>
        </section>
      </div>
    </>
  )
}
