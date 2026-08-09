import type { Metadata } from 'next'

import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
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
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Archive' }]}
      tabs={LEADS_TABS}
      activeTab='archive'
      count={{ label: 'archived leads', total: archivedLeads.length }}
      primaryAction={
        <Button asChild size='sm' className='gap-2'>
          <Link href='/leads/new'>
            <Plus className='h-4 w-4' />
            Add lead
          </Link>
        </Button>
      }
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm space-y-3'>
        <LeadsArchiveSection leads={archivedLeads} />
      </section>
    </PageShell>
  )
}
