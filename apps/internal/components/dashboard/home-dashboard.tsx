'use client'

import { PageShell } from '@/components/layout/page-shell'
import type { AssignedTaskSummary } from '@/lib/data/tasks'
import type { HoursSnapshot } from '@/lib/dashboard/types'

import { MyTasksWidget } from './my-tasks-widget'
import { RecentActivityOverviewWidget } from './recent-activity-overview-widget'
import { HoursWidget } from './hours-widget'

type HomeDashboardProps = {
  tasks: AssignedTaskSummary[]
  totalTaskCount: number
  initialHoursSnapshot: HoursSnapshot
}

export function HomeDashboard({
  tasks,
  totalTaskCount,
  initialHoursSnapshot,
}: HomeDashboardProps) {
  return (
    <PageShell breadcrumbs={[{ label: 'Home' }]}>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        <div>
          <MyTasksWidget
            tasks={tasks}
            totalCount={totalTaskCount}
            className='mb-6'
          />
        </div>
        <div>
          <HoursWidget
            initialSnapshot={initialHoursSnapshot}
            className='mb-6'
          />
          <RecentActivityOverviewWidget className='mb-6' />
        </div>
      </div>
    </PageShell>
  )
}
