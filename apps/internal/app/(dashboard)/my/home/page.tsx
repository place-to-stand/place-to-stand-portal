import type { Metadata } from 'next'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { requireUser } from '@/lib/auth/session'
import { MY_TASKS_WIDGET_PAGE_SIZE } from '@/lib/dashboard/types'
import { fetchHoursSnapshot } from '@/lib/data/dashboard/hours'
import { fetchDashboardLayout } from '@/lib/data/dashboard/layout'
import { fetchAssignedTasksSummary } from '@/lib/data/tasks'

export const metadata: Metadata = {
  title: 'Home',
}

export default async function HomePage() {
  const user = await requireUser()
  const now = new Date()
  const currentMonthCursor = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  }

  const [tasksResult, hoursSnapshot, layout] = await Promise.all([
    fetchAssignedTasksSummary({
      userId: user.id,
      limit: MY_TASKS_WIDGET_PAGE_SIZE,
      includeCompletedStatuses: false,
    }),
    fetchHoursSnapshot(user, currentMonthCursor),
    fetchDashboardLayout(user),
  ])

  return (
    <HomeDashboard
      tasks={tasksResult.items}
      totalTaskCount={tasksResult.totalCount}
      initialHoursSnapshot={hoursSnapshot}
      initialLayout={layout}
    />
  )
}
