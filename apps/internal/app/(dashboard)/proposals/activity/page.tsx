import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'

import { ProposalsTabsNav } from '../_components/proposals-tabs-nav'
import { ProposalsActivitySection } from '../_components/proposals-activity-section'

export const metadata: Metadata = {
  title: 'Proposal Activity | Place to Stand Portal',
}

export default async function ProposalsActivityPage() {
  await requireRole('ADMIN')

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Proposals</h1>
          <p className='text-muted-foreground text-sm'>
            Review proposal-level changes to keep audit history clear.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <ProposalsTabsNav activeTab='activity' className='flex-1 sm:flex-none' />
        </div>
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <ProposalsActivitySection />
        </section>
      </div>
    </>
  )
}
