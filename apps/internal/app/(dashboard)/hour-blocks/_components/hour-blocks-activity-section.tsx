'use client'

import dynamic from 'next/dynamic'

const HourBlocksActivityFeed = dynamic(
  () =>
    import('@/components/activity/activity-feed').then(
      module => module.ActivityFeed
    ),
  {
    ssr: false,
    loading: () => (
      <div className='text-muted-foreground text-sm'>
        Loading recent activity...
      </div>
    ),
  }
)

export function HourBlocksActivitySection() {
  return (
    <div className='space-y-3'>
      <div>
        <h3 className='text-lg font-semibold'>Recent activity</h3>
        <p className='text-muted-foreground text-sm'>
          Audit hour block creation, edits, archives, and deletions in one
          place.
        </p>
      </div>
      <HourBlocksActivityFeed
        targetType='HOUR_BLOCK'
        pageSize={20}
        emptyState='No recent hour block activity.'
        requireContext={false}
      />
    </div>
  )
}
