import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'
import { SUBMISSIONS_TABS } from '../_lib/tabs'
import { EntityActivityPage } from '@/components/activity/entity-activity-page'

export const metadata: Metadata = {
  title: 'Submission activity',
}

export default async function SubmissionsActivityPage() {
  await requirePage('submissions.manage')

  return (
    <EntityActivityPage
      navHref='/submissions'
      tabs={SUBMISSIONS_TABS}
      targetType='SUBMISSION'
      emptyState='No recent submission activity.'
      description='Audit submission acknowledgement changes, archives, restores, and deletions in one place.'
    />
  )
}
