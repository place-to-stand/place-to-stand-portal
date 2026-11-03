import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { IntegrationsPanel } from './integrations-panel'

export const metadata: Metadata = {
  title: 'Integrations | Settings',
}

export default async function IntegrationsSettingsPage() {
  await requirePage('integrations.manage')
  return (
    <PageShell breadcrumbs={crumbsForNav('/settings/integrations')}>
      <IntegrationsPanel />
    </PageShell>
  )
}
