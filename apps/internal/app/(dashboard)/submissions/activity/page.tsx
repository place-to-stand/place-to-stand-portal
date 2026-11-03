import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { ActivitySection } from '@/components/activity/activity-section'
import { SUBMISSIONS_TABS } from '../_lib/tabs'
import { PagePanel } from '@/components/layout/page-panel'

export const metadata: Metadata = {
  title: 'Submission activity',
}

export default async function SubmissionsActivityPage() {
  await requirePage('submissions.manage')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/submissions'), { label: 'Activity' }]}
      tabs={SUBMISSIONS_TABS}
      activeTab='activity'
    >
      <PagePanel>
        <ActivitySection
          targetType='SUBMISSION'
          emptyState='No recent submission activity.'
          description='Audit submission acknowledgement changes, archives, restores, and deletions in one place.'
        />
      </PagePanel>
    </PageShell>
  )
}
