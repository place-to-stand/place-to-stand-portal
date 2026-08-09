import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'

import { LEADS_TABS } from '../_lib/tabs'
import { LeadsActivitySection } from '../_components/leads-activity-section'

export const metadata: Metadata = {
  title: 'Lead Activity | Place to Stand Portal',
}

export default async function LeadsActivityPage() {
  const user = await requireUser()
  assertAdmin(user)

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Activity' }]}
      tabs={LEADS_TABS}
      activeTab='activity'
    >
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
    </PageShell>
  )
}
