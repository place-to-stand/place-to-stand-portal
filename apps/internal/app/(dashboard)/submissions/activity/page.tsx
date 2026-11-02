import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { ActivitySection } from '@/components/activity/activity-section'
import { SUBMISSIONS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Submission activity',
}

export default async function SubmissionsActivityPage() {
  await requireRole('ADMIN')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/submissions'), { label: 'Activity' }]}
      tabs={SUBMISSIONS_TABS}
      activeTab='activity'
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ActivitySection
          targetType='SUBMISSION'
          emptyState='No recent submission activity.'
          description='Audit submission acknowledgement changes, archives, restores, and deletions in one place.'
        />
      </section>
    </PageShell>
  )
}
