import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { SubmissionsActivitySection } from '../_components/submissions-activity-section'
import { SUBMISSIONS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Submissions Activity',
}

// Auth lives here, behind Suspense, so the page keeps a prerenderable shell
// (Cache Components instant-navigation pattern).
async function SubmissionsActivityContent() {
  await requireRole('ADMIN')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/submissions'), { label: 'Activity' }]}
      tabs={SUBMISSIONS_TABS}
      activeTab='activity'
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <SubmissionsActivitySection />
      </section>
    </PageShell>
  )
}

// Identical header chrome so only the content area pulses while auth resolves.
function SubmissionsActivityPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/submissions'), { label: 'Activity' }]}
      tabs={SUBMISSIONS_TABS}
      activeTab='activity'
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function SubmissionsActivityPage() {
  return (
    <Suspense fallback={<SubmissionsActivityPageFallback />}>
      <SubmissionsActivityContent />
    </Suspense>
  )
}
