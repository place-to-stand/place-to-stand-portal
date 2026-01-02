'use client'

import dynamic from 'next/dynamic'

const UsersActivityFeed = dynamic(
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

export function UsersActivitySection() {
  return (
    <div className='space-y-3'>
      <div>
        <h3 className='text-lg font-semibold'>Recent activity</h3>
        <p className='text-muted-foreground text-sm'>
          Keep tabs on invitations, role updates, and archive decisions.
        </p>
      </div>
      <UsersActivityFeed
        targetType='USER'
        pageSize={20}
        emptyState='No recent user management activity.'
        requireContext={false}
      />
    </div>
  )
}
