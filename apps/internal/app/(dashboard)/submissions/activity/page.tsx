import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { SubmissionsActivitySection } from '../_components/submissions-activity-section'
import { SUBMISSIONS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Submissions Activity',
}

export default async function SubmissionsActivityPage() {
  await requireRole('ADMIN')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/submissions'), { label: 'Activity' }]}
      tabs={SUBMISSIONS_TABS}
      activeTab='activity'
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <SubmissionsActivitySection />
      </section>
    </PageShell>
  )
}
