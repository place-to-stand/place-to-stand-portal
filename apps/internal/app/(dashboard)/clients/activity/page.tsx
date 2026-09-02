import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'

import { CLIENTS_TABS } from '../_lib/tabs'
import { ClientsAddButton } from '../_components/clients-add-button'
import { ClientsActivitySection } from '../_components/clients-activity-section'

export const metadata: Metadata = {
  title: 'Client Activity | Place to Stand Portal',
}

// All auth access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function ClientsActivityContent() {
  await requireRole('ADMIN')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: 'Activity' }]}
      tabs={CLIENTS_TABS}
      activeTab='activity'
      primaryAction={<ClientsAddButton />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ClientsActivitySection />
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs · add button) so only the
// content area pulses while auth resolves.
function ClientsActivityPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: 'Activity' }]}
      tabs={CLIENTS_TABS}
      activeTab='activity'
      primaryAction={<ClientsAddButton />}
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function ClientsActivityPage() {
  return (
    <Suspense fallback={<ClientsActivityPageFallback />}>
      <ClientsActivityContent />
    </Suspense>
  )
}
