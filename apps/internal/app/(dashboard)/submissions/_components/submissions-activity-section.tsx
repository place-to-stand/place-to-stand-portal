'use client'

import dynamic from 'next/dynamic'

const SubmissionsActivityFeed = dynamic(
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

export function SubmissionsActivitySection() {
  return (
    <div className='space-y-3'>
      <div>
        <h3 className='text-lg font-semibold'>Recent activity</h3>
        <p className='text-muted-foreground text-sm'>
          Audit submission acknowledgement changes, archives, restores, and
          deletions in one place.
        </p>
      </div>
      <SubmissionsActivityFeed
        targetType='SUBMISSION'
        pageSize={20}
        emptyState='No recent submission activity.'
        requireContext={false}
      />
    </div>
  )
}
