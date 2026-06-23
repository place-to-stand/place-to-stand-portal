import type { Metadata } from 'next'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { requireUser } from '@/lib/auth/session'
import { fetchHoursSnapshot } from '@/lib/data/dashboard/hours'
import { fetchAssignedTasksSummary } from '@/lib/data/tasks'

export const metadata: Metadata = {
  title: 'Home | Place to Stand Portal',
}

export default async function HomePage() {
  const user = await requireUser()
  const now = new Date()
  const currentMonthCursor = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  }

  const [tasksResult, hoursSnapshot] = await Promise.all([
    fetchAssignedTasksSummary({
      userId: user.id,
      role: user.role,
      limit: 5,
      includeCompletedStatuses: false,
    }),
    fetchHoursSnapshot(user, currentMonthCursor),
  ])

  return (
    <HomeDashboard
      user={user}
      tasks={tasksResult.items}
      totalTaskCount={tasksResult.totalCount}
      initialHoursSnapshot={hoursSnapshot}
    />
  )
}
