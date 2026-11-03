import type { Metadata } from 'next'

import { ActivitySection } from '@/components/activity/activity-section'
import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { LogTimeButton } from '../_components/log-time-button'
import { loadLogTimeProjects } from '../_lib/load-time-logs-list'
import { TIME_LOGS_TABS } from '../_lib/tabs'
import { PagePanel } from '@/components/layout/page-panel'

export const metadata: Metadata = {
  title: 'Time log activity',
}

export default async function TimeLogsActivityPage() {
  await requirePage('activity.read_all')
  const logTimeProjects = await loadLogTimeProjects()

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/time-logs'), { label: 'Activity' }]}
      tabs={TIME_LOGS_TABS}
      activeTab='activity'
      primaryAction={<LogTimeButton projects={logTimeProjects} />}
    >
      <PagePanel>
        <ActivitySection
          targetType='TIME_LOG'
          emptyState='No recent time log activity.'
          description='Audit time logs, edits, archives, and restores in one place.'
        />
      </PagePanel>
    </PageShell>
  )
}
