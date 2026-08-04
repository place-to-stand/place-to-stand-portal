import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'

import { SubmissionsActivitySection } from '../_components/submissions-activity-section'
import { SubmissionsTabsNav } from '../_components/submissions-tabs-nav'

export const metadata: Metadata = {
  title: 'Submissions Activity',
}

export default async function SubmissionsActivityPage() {
  await requireRole('ADMIN')

  return (
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Submissions</h1>
          <p className='text-muted-foreground text-sm'>
            Audit submission acknowledgements, archives, and restores in one
            place.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <SubmissionsTabsNav
            activeTab='activity'
            className='flex-1 sm:flex-none'
          />
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <SubmissionsActivitySection />
        </section>
      </div>
    </>
  )
}
