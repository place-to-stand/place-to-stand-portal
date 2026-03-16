'use client'

import dynamic from 'next/dynamic'

const ContactsActivityFeed = dynamic(
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

export function ContactsActivitySection() {
  return (
    <section className='bg-background rounded-xl border p-6 shadow-sm'>
      <div className='space-y-3 p-1'>
        <div>
          <h3 className='text-lg font-semibold'>Recent activity</h3>
          <p className='text-muted-foreground text-sm'>
            Review contact creation, edits, archives, and restorations in one place.
          </p>
        </div>
        <ContactsActivityFeed
          targetType='CONTACT'
          pageSize={20}
          emptyState='No recent contact activity.'
          requireContext={false}
        />
      </div>
    </section>
  )
}
