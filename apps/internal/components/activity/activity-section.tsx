'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

const ActivityFeed = dynamic(
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

type ActivitySectionProps = {
  targetType: ComponentProps<typeof ActivityFeed>['targetType']
  emptyState: string
  /** One line under the "Recent activity" heading; omit to show the feed alone. */
  description?: string
}

/** The Activity tab body every list page shares: heading plus the feed. */
export function ActivitySection({
  targetType,
  emptyState,
  description,
}: ActivitySectionProps) {
  const feed = (
    <ActivityFeed
      targetType={targetType}
      pageSize={20}
      emptyState={emptyState}
      requireContext={false}
    />
  )

  if (!description) return feed

  return (
    <div className='space-y-3'>
      <div>
        <h3 className='text-lg font-semibold'>Recent activity</h3>
        <p className='text-muted-foreground text-sm'>{description}</p>
      </div>
      {feed}
    </div>
  )
}
