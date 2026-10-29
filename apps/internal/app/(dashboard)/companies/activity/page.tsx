import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireCrmUser } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { COMPANIES_TABS } from '../_lib/tabs'
import { ActivitySection } from '@/components/activity/activity-section'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'

export const metadata: Metadata = {
  title: 'Company activity',
}

export default async function CompaniesActivityPage() {
  await requireCrmUser()

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/companies'), { label: 'Activity' }]}
      tabs={COMPANIES_TABS}
      activeTab='activity'
      primaryAction={<SheetCreateButton entity='company' label='Add company' />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ActivitySection
          targetType='COMPANY'
          emptyState='No recent company activity.'
          description='New companies, edits, primary contacts, archives and restores.'
        />
      </section>
    </PageShell>
  )
}
