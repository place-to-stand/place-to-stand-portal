'use client'

import dynamic from 'next/dynamic'

const InvoicesActivityFeed = dynamic(
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

export function InvoicesActivitySection() {
  return (
    <div className='space-y-3'>
      <div>
        <h3 className='text-lg font-semibold'>Recent activity</h3>
        <p className='text-muted-foreground text-sm'>
          Audit invoice creation, edits, sends, voids, and deletions in one
          place.
        </p>
      </div>
      <InvoicesActivityFeed
        targetType='INVOICE'
        pageSize={20}
        emptyState='No recent invoice activity.'
        requireContext={false}
      />
    </div>
  )
}
