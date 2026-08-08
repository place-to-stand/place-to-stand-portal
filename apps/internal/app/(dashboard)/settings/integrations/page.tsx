import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { IntegrationsPanel } from './integrations-panel'

export const metadata: Metadata = {
  title: 'Integrations | Settings',
}

export default function IntegrationsSettingsPage() {
  return (
    <PageShell breadcrumbs={crumbsForNav('/settings/integrations')}>
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <IntegrationsPanel />
      </section>
    </PageShell>
  )
}
