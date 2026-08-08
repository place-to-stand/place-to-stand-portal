import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'

import { CLIENTS_TABS } from '../_lib/tabs'
import { ClientsAddButton } from '../_components/clients-add-button'
import { ClientsActivitySection } from '../_components/clients-activity-section'

export const metadata: Metadata = {
  title: 'Client Activity | Place to Stand Portal',
}

export default async function ClientsActivityPage() {
  await requireRole('ADMIN')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: 'Activity' }]}
      tabs={CLIENTS_TABS}
      activeTab='activity'
      primaryAction={<ClientsAddButton />}
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <ClientsActivitySection />
      </section>
    </PageShell>
  )
}
