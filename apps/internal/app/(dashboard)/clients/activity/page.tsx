import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'

import { CLIENTS_TABS } from '../_lib/tabs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { ActivitySection } from '@/components/activity/activity-section'

export const metadata: Metadata = {
  title: 'Client activity',
}

export default async function ClientsActivityPage() {
  await requireRole('ADMIN')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: 'Activity' }]}
      tabs={CLIENTS_TABS}
      activeTab='activity'
      primaryAction={<SheetCreateButton entity='client' label='Add client' />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ActivitySection
          targetType='CLIENT'
          emptyState='No recent client activity.'
          description='Audit client creation, edits, archives, and deletions in one place.'
        />
      </section>
    </PageShell>
  )
}
