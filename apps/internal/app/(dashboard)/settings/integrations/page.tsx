import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { IntegrationsPanel } from './integrations-panel'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = {
  title: 'Integrations | Settings',
}

export default function IntegrationsSettingsPage() {
  return (
    <PageShell breadcrumbs={crumbsForNav('/settings/integrations')}>
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <IntegrationsPanel />
      </section>
    </PageShell>
  )
}
