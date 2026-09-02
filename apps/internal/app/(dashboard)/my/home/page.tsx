import type { Metadata } from 'next'
import { Suspense } from 'react'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import { PageShell } from '@/components/layout/page-shell'
import { requireUser } from '@/lib/auth/session'
import { fetchHoursSnapshot } from '@/lib/data/dashboard/hours'
import { fetchAssignedTasksSummary } from '@/lib/data/tasks'

export const metadata: Metadata = {
  title: 'Home | Place to Stand Portal',
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function HomeContent() {
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

// Same header chrome as HomeDashboard's PageShell so only the widget grid
// pulses while data streams in.
function HomePageFallback() {
  return (
    <PageShell breadcrumbs={[{ label: 'Home' }]}>
      {/* Widget gutters match the shell's content padding (p-3 sm:p-4). */}
      <div className='grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2'>
        <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
        <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
      </div>
    </PageShell>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomeContent />
    </Suspense>
  )
}
