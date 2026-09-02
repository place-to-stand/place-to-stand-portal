import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { UsersAddButton } from '../_components/users-add-button'
import { UsersActivitySection } from '../_components/users-activity-section'
import { USERS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'User Activity | Settings',
}

// Auth lives here, behind Suspense, so the page keeps a prerenderable shell
// (Cache Components instant-navigation pattern).
async function UsersActivityContent() {
  await requireRole('ADMIN')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/settings/users'), { label: 'Activity' }]}
      tabs={USERS_TABS}
      activeTab='activity'
      primaryAction={
        <UsersAddButton />
      }
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <UsersActivitySection />
      </section>
    </PageShell>
  )
}

// Identical header chrome so only the content area pulses while auth resolves.
function UsersActivityPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/settings/users'), { label: 'Activity' }]}
      tabs={USERS_TABS}
      activeTab='activity'
      primaryAction={
        <UsersAddButton />
      }
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function UsersActivityPage() {
  return (
    <Suspense fallback={<UsersActivityPageFallback />}>
      <UsersActivityContent />
    </Suspense>
  )
}
