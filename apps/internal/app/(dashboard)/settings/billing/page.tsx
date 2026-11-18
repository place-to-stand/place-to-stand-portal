import type { Metadata } from 'next'

import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { loadProfitShareForm } from '@/lib/billing/profit-share-query'
import { listAllProductCatalogItems } from '@/lib/queries/product-catalog'
import { listTaxRates } from '@/lib/queries/tax-rates'

import { BillingSettingsForm } from './_components/billing-settings-form'

import { SETTINGS_TABS, settingsCrumbs } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Billing | Settings',
}

/**
 * Settings → Billing: what invoices are built from (products, tax rates) and
 * how the monthly close splits profit, as one page form with one Save.
 */
export default async function BillingSettingsPage() {
  await requirePage('billing.manage')

  const [products, taxRates, profitShare] = await Promise.all([
    listAllProductCatalogItems(),
    listTaxRates(),
    loadProfitShareForm(),
  ])

  return (
    <PageShell
      breadcrumbs={settingsCrumbs('billing')}
      tabs={SETTINGS_TABS}
      activeTab='billing'
    >
      <PagePanel>
        <BillingSettingsForm
          products={products}
          taxRates={taxRates}
          profitShare={profitShare}
        />
      </PagePanel>
    </PageShell>
  )
}
