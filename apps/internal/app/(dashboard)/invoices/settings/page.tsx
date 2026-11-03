import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listAllProductCatalogItems } from '@/lib/queries/product-catalog'
import { listTaxRates } from '@/lib/queries/tax-rates'

import { INVOICES_TABS } from '../_lib/tabs'
import { ProductCatalogSection } from './_components/product-catalog-section'
import { TaxRatesSection } from './_components/tax-rates-section'
import { PagePanel } from '@/components/layout/page-panel'

export const metadata: Metadata = {
  title: 'Invoice settings',
}

export default async function InvoiceSettingsPage() {
  await requirePage('billing.manage')

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
      <PagePanel>
        <div className='space-y-10'>
          <ProductCatalogSection initialItems={products} />
          <TaxRatesSection initialRates={taxRates} />
        </div>
      </PagePanel>
    </PageShell>
  )
}
