import type { Metadata } from 'next'

import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { loadBusinessSettingsForm } from '@/lib/business/settings-query'

import { BusinessSettingsForm } from './_components/business-settings-form'

import { SETTINGS_TABS, settingsCrumbs } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Business | Settings',
}

export default async function BusinessSettingsPage() {
  await requirePage('settings.business')
  const initial = await loadBusinessSettingsForm()

  return (
    <PageShell
      breadcrumbs={settingsCrumbs('business')}
      tabs={SETTINGS_TABS}
      activeTab='business'
    >
      <PagePanel>
        <BusinessSettingsForm initial={initial} />
      </PagePanel>
    </PageShell>
  )
}
