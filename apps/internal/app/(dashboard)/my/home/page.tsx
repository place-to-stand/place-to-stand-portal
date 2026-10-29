import type { Metadata } from 'next'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { requireCrmUser } from '@/lib/auth/session'
import { dashboardKindForRole } from '@/lib/dashboard/layout'
import { MY_TASKS_WIDGET_PAGE_SIZE } from '@/lib/dashboard/types'
import { fetchHoursSnapshot } from '@/lib/data/dashboard/hours'
import { fetchDashboardLayout } from '@/lib/data/dashboard/layout'
import { fetchSalesHomeData } from '@/lib/data/dashboard/sales'
import { fetchAssignedTasksSummary } from '@/lib/data/tasks'

export const metadata: Metadata = {
  title: 'Home',
}

export default async function HomePage() {
  // SALES users land here (it is their home), so this page must not use
  // requireUser, which would send them straight back.
  const user = await requireCrmUser()
  const kind = dashboardKindForRole(user.role)

  if (kind === 'sales') {
    const [sales, layout] = await Promise.all([
      fetchSalesHomeData(user),
      fetchDashboardLayout(user),
    ])
    return <HomeDashboard sales={sales} initialLayout={layout} kind='sales' />
  }

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
