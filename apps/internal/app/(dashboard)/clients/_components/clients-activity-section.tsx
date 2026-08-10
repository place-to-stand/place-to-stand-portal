'use client'

import dynamic from 'next/dynamic'

const ClientsActivityFeed = dynamic(
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

export function ClientsActivitySection() {
  return (
    <div className='space-y-3'>
      <div>
        <h3 className='text-lg font-semibold'>Recent activity</h3>
        <p className='text-muted-foreground text-sm'>
          Review client creation, edits, archives, and restorations in one place.
        </p>
      </div>
      <ClientsActivityFeed
        targetType='CLIENT'
        pageSize={20}
        emptyState='No recent client activity.'
        requireContext={false}
      />
    </div>
  )
}
