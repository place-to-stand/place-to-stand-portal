import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchArchivedLeads } from '@/lib/data/leads'

import { LEADS_TABS } from '../_lib/tabs'
import { LeadsArchiveSection } from '../_components/leads-archive-section'

export const metadata: Metadata = {
  title: 'Lead Archive | Place to Stand Portal',
}

export default async function LeadsArchivePage() {
  const user = await requireUser()
  assertAdmin(user)

  const archivedLeads = await fetchArchivedLeads(user)

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads/board'), { label: 'Archive' }]}
      tabs={LEADS_TABS}
      activeTab='archive'
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm space-y-3'>
        <div>
          <h3 className='text-lg font-semibold'>Archived leads</h3>
          <p className='text-muted-foreground text-sm'>
            Review archived leads and restore them when opportunities reopen.
          </p>
        </div>
        <LeadsArchiveSection leads={archivedLeads} />
      </section>
    </PageShell>
  )
}
