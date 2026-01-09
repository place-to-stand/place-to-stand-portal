import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listClientsForSettings } from '@/lib/queries/clients'

import { ClientsTabsNav } from '../_components/clients-tabs-nav'
import { ClientsAddButton } from '../_components/clients-add-button'
import { ClientsActivitySection } from '../_components/clients-activity-section'
import {
  normalizeClientMembersMap,
  normalizeClientUsers,
} from '../_lib/client-user-helpers'

export const metadata: Metadata = {
  title: 'Client Activity | Place to Stand Portal',
}

export default async function ClientsActivityPage() {
  const admin = await requireRole('ADMIN')

  const { membersByClient, clientUsers } = await listClientsForSettings(admin, {
    status: 'active',
    limit: 1,
  })

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Clients</h1>
          <p className='text-muted-foreground text-sm'>
            Review client-level changes to keep audit history clear.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <ClientsTabsNav activeTab='activity' className='flex-1 sm:flex-none' />
          <ClientsAddButton
            clientUsers={normalizeClientUsers(clientUsers)}
            clientMembers={normalizeClientMembersMap(membersByClient)}
          />
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <ClientsActivitySection />
        </section>
      </div>
    </>
  )
}
