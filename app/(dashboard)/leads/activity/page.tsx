import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'

import { LeadsHeader } from '../_components/leads-header'
import { LeadsTabsNav } from '../_components/leads-tabs-nav'
import { LeadsActivitySection } from '../_components/leads-activity-section'

export const metadata: Metadata = {
  title: 'Lead Activity | Place to Stand Portal',
}

export default async function LeadsActivityPage() {
  const user = await requireUser()
  assertAdmin(user)

  return (
    <div className='flex h-full min-h-0 flex-col gap-6'>
      <AppShellHeader>
        <LeadsHeader />
      </AppShellHeader>
      <div className='space-y-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <LeadsTabsNav activeTab='activity' />
        </div>
        <section className='bg-background rounded-xl border p-6 shadow-sm space-y-3'>
          <div>
            <h3 className='text-lg font-semibold'>Recent activity</h3>
            <p className='text-muted-foreground text-sm'>
              Audit lead creation, edits, archives, and status changes in one
              place.
            </p>
          </div>
          <LeadsActivitySection />
        </section>
      </div>
    </div>
  )
}
