import type { Metadata } from 'next'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { requireUser } from '@/lib/auth/session'
import { fetchHoursSnapshot } from '@/lib/data/dashboard/hours'
import { fetchAssignedTasksSummary } from '@/lib/data/tasks'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

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
      limit: 5,
      includeCompletedStatuses: false,
    }),
    fetchHoursSnapshot(user, currentMonthCursor),
  ])

  return (
    <HomeDashboard

      tasks={tasksResult.items}
      totalTaskCount={tasksResult.totalCount}
      initialHoursSnapshot={hoursSnapshot}
    />
  )
}
