import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { fetchArchivedProposals } from '@/lib/queries/proposals'

import { ProposalsTabsNav } from '../_components/proposals-tabs-nav'
import { ProposalsArchiveTable } from '../_components/proposals-archive-table'

export const metadata: Metadata = {
  title: 'Proposal Archive | Place to Stand Portal',
}

export default async function ProposalsArchivePage() {
  await requireRole('ADMIN')

  const proposals = await fetchArchivedProposals()

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Proposals</h1>
          <p className='text-muted-foreground text-sm'>
            Review archived proposals and restore them when needed.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <ProposalsTabsNav activeTab='archive' className='flex-1 sm:flex-none' />
          <span className='text-muted-foreground text-sm whitespace-nowrap'>
            Total archived: {proposals.length}
          </span>
        </div>
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <ProposalsArchiveTable proposals={proposals} />
        </section>
      </div>
    </>
  )
}
