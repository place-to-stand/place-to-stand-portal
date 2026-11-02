import type { Metadata } from 'next'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { requireCrmUser } from '@/lib/auth/session'
import type { DashboardWidgetId } from '@/lib/dashboard/layout'
import { MY_TASKS_WIDGET_PAGE_SIZE } from '@/lib/dashboard/types'
import { fetchHoursSnapshot } from '@/lib/data/dashboard/hours'
import { fetchDashboardLayout } from '@/lib/data/dashboard/layout'
import { fetchSalesHomeData } from '@/lib/data/dashboard/sales'
import { fetchAssignedTasksSummary } from '@/lib/data/tasks'
import { listWorkableProjectIds } from '@/lib/projects/access'

export const metadata: Metadata = {
  title: 'Home',
}

const SALES_WIDGETS: readonly DashboardWidgetId[] = ['pipeline', 'quiet-leads']

export default async function HomePage() {
  // Every staff role lands here, so this page must not use requireUser,
  // which would send non-admins straight back.
  const user = await requireCrmUser()
  const layout = await fetchDashboardLayout(user)

  // Load what every widget in the layout needs, hidden ones included: the
  // edit tray shows hidden widgets with live content so you can see them
  // before adding them.
  const visible = new Set([...layout.columns.flat(), ...layout.hidden])
  const now = new Date()

  const [tasksResult, hoursSnapshot, sales] = await Promise.all([
    visible.has('my-tasks')
      ? listWorkableProjectIds(user).then(projectIds =>
          fetchAssignedTasksSummary({
            userId: user.id,
            projectIds,
            limit: MY_TASKS_WIDGET_PAGE_SIZE,
            includeCompletedStatuses: false,
            order: 'due',
          })
        )
      : null,
    visible.has('hours')
      ? fetchHoursSnapshot(user, {
          year: now.getUTCFullYear(),
          month: now.getUTCMonth() + 1,
        })
      : null,
    SALES_WIDGETS.some(id => visible.has(id)) ? fetchSalesHomeData(user) : null,
  ])

  return (
    <HomeDashboard
      tasks={tasksResult?.items}
      totalTaskCount={tasksResult?.totalCount}
      initialHoursSnapshot={hoursSnapshot ?? undefined}
      sales={sales ?? undefined}
      initialLayout={layout}
      role={user.role}
    />
  )
}
