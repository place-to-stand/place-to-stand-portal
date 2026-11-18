import type { Metadata } from 'next'

import { FORM_SECTIONS_CLASS } from '@/components/forms/form-section'
import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { loadProfitShareForm } from '@/lib/billing/profit-share-query'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listAllProductCatalogItems } from '@/lib/queries/product-catalog'
import { listTaxRates } from '@/lib/queries/tax-rates'

import { ProductCatalogSection } from './_components/product-catalog-section'
import { ProfitShareForm } from './_components/profit-share-form'
import { TaxRatesSection } from './_components/tax-rates-section'

export const metadata: Metadata = {
  title: 'Billing | Settings',
}

/**
 * Settings → Billing: what invoices are built from (products, tax rates) and
 * how the monthly close splits profit. Products and tax rates save as you
 * edit each one; the profit share has its own Save.
 */
export default async function BillingSettingsPage() {
  await requirePage('billing.manage')

  const [products, taxRates, profitShare] = await Promise.all([
    listAllProductCatalogItems(),
    listTaxRates(),
    loadProfitShareForm(),
  ])

  return (
    <PageShell breadcrumbs={crumbsForNav('/settings/billing')}>
      <PagePanel>
        <div className={FORM_SECTIONS_CLASS}>
          <ProductCatalogSection initialItems={products} />
          <TaxRatesSection initialRates={taxRates} />
          <ProfitShareForm initial={profitShare} />
        </div>
      </PagePanel>
    </PageShell>
  )
}
