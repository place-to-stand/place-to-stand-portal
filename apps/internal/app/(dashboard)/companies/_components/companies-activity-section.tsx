'use client'

import dynamic from 'next/dynamic'

const CompaniesActivityFeed = dynamic(
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

export function CompaniesActivitySection() {
  return (
    <div className='space-y-3'>
      <div>
        <h3 className='text-lg font-semibold'>Recent activity</h3>
        <p className='text-muted-foreground text-sm'>
          New companies, edits, champions, archives and restores.
        </p>
      </div>
      <CompaniesActivityFeed
        targetType='COMPANY'
        pageSize={20}
        emptyState='No recent company activity.'
        requireContext={false}
      />
    </div>
  )
}
