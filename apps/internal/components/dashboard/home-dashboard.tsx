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
      {/* Widget gutters match the shell's content padding (p-3 sm:p-4). */}
      <div className='grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2'>
        <div>
          <MyTasksWidget tasks={tasks} totalCount={totalTaskCount} />
        </div>
        <div className='flex flex-col gap-3 sm:gap-4'>
          <HoursWidget initialSnapshot={initialHoursSnapshot} />
          <RecentActivityOverviewWidget />
        </div>
      </div>
    </PageShell>
  )
}
