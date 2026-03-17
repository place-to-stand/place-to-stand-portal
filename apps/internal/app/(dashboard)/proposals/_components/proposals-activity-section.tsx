'use client'

import dynamic from 'next/dynamic'

const ProposalsActivityFeed = dynamic(
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

export function ProposalsActivitySection() {
  return (
    <div className='space-y-3 p-1'>
      <div>
        <h3 className='text-lg font-semibold'>Recent activity</h3>
        <p className='text-muted-foreground text-sm'>
          Review proposal creation, sends, responses, and archives in one place.
        </p>
      </div>
      <ProposalsActivityFeed
        targetType='PROPOSAL'
        pageSize={20}
        emptyState='No recent proposal activity.'
        requireContext={false}
      />
    </div>
  )
}
