import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { SubmissionsActivitySection } from '../_components/submissions-activity-section'
import { SUBMISSIONS_TABS } from '../_lib/tabs'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = {
  title: 'Submissions Activity',
}

export default async function SubmissionsActivityPage() {
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
