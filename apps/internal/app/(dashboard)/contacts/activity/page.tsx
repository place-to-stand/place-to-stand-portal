import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'

import { ContactsTabsNav } from '../_components/contacts-tabs-nav'
import { ContactsAddButton } from '../_components/contacts-add-button'
import { ContactsActivitySection } from '../_components/contacts-activity-section'

export const metadata: Metadata = {
  title: 'Contact Activity | Place to Stand Portal',
}

export default async function ContactsActivityPage() {
  await requireRole('ADMIN')

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Contacts</h1>
          <p className='text-muted-foreground text-sm'>
            Review contact-level changes to keep audit history clear.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <ContactsTabsNav activeTab='activity' className='flex-1 sm:flex-none' />
          <ContactsAddButton />
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <ContactsActivitySection />
        </section>
      </div>
    </>
  )
}
