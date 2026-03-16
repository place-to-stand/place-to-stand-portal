import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listHourBlocksForSettings } from '@/lib/queries/hour-blocks'

import { HourBlocksTabsNav } from '../_components/hour-blocks-tabs-nav'
import { HourBlocksAddButton } from '../_components/hour-blocks-add-button'
import { HourBlocksActivitySection } from '../_components/hour-blocks-activity-section'

export const metadata: Metadata = {
  title: 'Hour Blocks Activity | Settings',
}

export default async function HourBlocksActivityPage() {
  const currentUser = await requireRole('ADMIN')

  const { clients } = await listHourBlocksForSettings(currentUser, {
    status: 'active',
    limit: 1,
  })

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Hour Blocks</h1>
          <p className='text-muted-foreground text-sm'>
            Review hour block activity to keep audit history clear.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <HourBlocksTabsNav activeTab='activity' className='flex-1 sm:flex-none' />
          <HourBlocksAddButton clients={clients} />
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <HourBlocksActivitySection />
        </section>
      </div>
    </>
  )
}
