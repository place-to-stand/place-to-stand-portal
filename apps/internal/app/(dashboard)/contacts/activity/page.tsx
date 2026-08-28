import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'

import { CONTACTS_TABS } from '../_lib/tabs'
import { ContactsAddButton } from '../_components/contacts-add-button'
import { ContactsActivitySection } from '../_components/contacts-activity-section'

export const metadata: Metadata = {
  title: 'Contact Activity | Place to Stand Portal',
}

// All auth access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function ContactsActivityContent() {
  await requireRole('ADMIN')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/contacts'), { label: 'Activity' }]}
      tabs={CONTACTS_TABS}
      activeTab='activity'
      primaryAction={<ContactsAddButton />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ContactsActivitySection />
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs · add button) so only the
// content area pulses while auth resolves.
function ContactsActivityPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/contacts'), { label: 'Activity' }]}
      tabs={CONTACTS_TABS}
      activeTab='activity'
      primaryAction={<ContactsAddButton />}
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function ContactsActivityPage() {
  return (
    <Suspense fallback={<ContactsActivityPageFallback />}>
      <ContactsActivityContent />
    </Suspense>
  )
}
