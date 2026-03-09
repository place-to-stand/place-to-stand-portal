import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchArchivedLeads } from '@/lib/data/leads'

import { LeadsHeader } from '../_components/leads-header'
import { LeadsTabsNav } from '../_components/leads-tabs-nav'
import { LeadsArchiveSection } from '../_components/leads-archive-section'

export const metadata: Metadata = {
  title: 'Lead Archive | Place to Stand Portal',
}

export default async function LeadsArchivePage() {
  const user = await requireUser()
  assertAdmin(user)

  const archivedLeads = await fetchArchivedLeads(user)

  return (
    <div className='flex h-full min-h-0 flex-col gap-6'>
      <AppShellHeader>
        <LeadsHeader />
      </AppShellHeader>
      <div className='space-y-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <LeadsTabsNav activeTab='archive' />
        </div>
        <section className='bg-background rounded-xl border p-6 shadow-sm space-y-3'>
          <div>
            <h3 className='text-lg font-semibold'>Archived leads</h3>
            <p className='text-muted-foreground text-sm'>
              Review archived leads and restore them when opportunities reopen.
            </p>
          </div>
          <LeadsArchiveSection leads={archivedLeads} />
        </section>
      </div>
    </div>
  )
}
