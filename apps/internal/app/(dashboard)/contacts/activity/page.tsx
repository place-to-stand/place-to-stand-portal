import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'

import { CONTACTS_TABS } from '../_lib/tabs'
import { ContactsAddButton } from '../_components/contacts-add-button'
import { ContactsActivitySection } from '../_components/contacts-activity-section'

export const metadata: Metadata = {
  title: 'Contact Activity | Place to Stand Portal',
}

export default async function ContactsActivityPage() {
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
