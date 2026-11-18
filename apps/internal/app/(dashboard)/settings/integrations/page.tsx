import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'

import { IntegrationsPanel } from './integrations-panel'

import { SETTINGS_TABS, settingsCrumbs } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Integrations | Settings',
}

export default async function IntegrationsSettingsPage() {
  await requirePage('integrations.manage')
  return (
    <PageShell
      breadcrumbs={settingsCrumbs('integrations')}
      tabs={SETTINGS_TABS}
      activeTab='integrations'
    >
      <PagePanel>
        <IntegrationsPanel />
      </PagePanel>
    </PageShell>
  )
}
