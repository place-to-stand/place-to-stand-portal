'use client'

import dynamic from 'next/dynamic'

const LeadsActivityFeed = dynamic(
  () =>
    import('@/components/activity/activity-feed').then(
      module => module.ActivityFeed
    ),
  {
    ssr: false,
    loading: () => (
      <div className='text-muted-foreground text-sm'>
        Loading recent activity…
      </div>
    ),
  }
)

export function LeadsActivitySection() {
  return (
    <LeadsActivityFeed
      targetType='LEAD'
      pageSize={20}
      emptyState='No recent lead activity.'
      requireContext={false}
    />
  )
}
