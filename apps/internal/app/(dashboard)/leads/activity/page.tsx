import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'

import { LEADS_TABS } from '../_lib/tabs'
import { LeadsActivitySection } from '../_components/leads-activity-section'

export const metadata: Metadata = {
  title: 'Lead Activity | Place to Stand Portal',
}

// All auth lives here, behind Suspense, so the page keeps a prerenderable
// shell and client navigations commit instantly (Cache Components
// instant-navigation pattern).
async function LeadsActivityContent() {
  const user = await requireUser()
  assertAdmin(user)

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Activity' }]}
      tabs={LEADS_TABS}
      activeTab='activity'
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm space-y-3'>
        <div>
          <h3 className='text-lg font-semibold'>Recent activity</h3>
          <p className='text-muted-foreground text-sm'>
            Audit lead creation, edits, archives, and status changes in one
            place.
          </p>
        </div>
        <LeadsActivitySection />
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs) so only the content area pulses
// while auth resolves.
function LeadsActivityPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Activity' }]}
      tabs={LEADS_TABS}
      activeTab='activity'
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function LeadsActivityPage() {
  return (
    <Suspense fallback={<LeadsActivityPageFallback />}>
      <LeadsActivityContent />
    </Suspense>
  )
}
