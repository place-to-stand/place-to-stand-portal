import type { Metadata } from 'next'

import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { loadBusinessSettingsForm } from '@/lib/business/settings-query'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { BusinessSettingsForm } from './_components/business-settings-form'

export const metadata: Metadata = {
  title: 'Business | Settings',
}

export default async function BusinessSettingsPage() {
  await requirePage('settings.business')
  const initial = await loadBusinessSettingsForm()

  return (
    <PageShell breadcrumbs={crumbsForNav('/settings/business')}>
      <PagePanel>
        <BusinessSettingsForm initial={initial} />
      </PagePanel>
    </PageShell>
  )
}
