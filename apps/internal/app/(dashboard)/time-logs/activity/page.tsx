import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'
import { LogTimeButton } from '../_components/log-time-button'
import { loadLogTimeProjects } from '../_lib/load-time-logs-list'
import { TIME_LOGS_TABS } from '../_lib/tabs'
import { EntityActivityPage } from '@/components/activity/entity-activity-page'

export const metadata: Metadata = {
  title: 'Time log activity',
}

export default async function TimeLogsActivityPage() {
  await requirePage('activity.read_all')
  const logTimeProjects = await loadLogTimeProjects()

  return (
    <EntityActivityPage
      navHref='/time-logs'
      tabs={TIME_LOGS_TABS}
      primaryAction={<LogTimeButton projects={logTimeProjects} />}
      targetType='TIME_LOG'
      emptyState='No recent time log activity.'
      description='Audit time logs, edits, archives, and restores in one place.'
    />
  )
}
