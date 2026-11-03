import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { COMPANIES_TABS } from '../_lib/tabs'
import { ActivitySection } from '@/components/activity/activity-section'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { PagePanel } from '@/components/layout/page-panel'

export const metadata: Metadata = {
  title: 'Company activity',
}

export default async function CompaniesActivityPage() {
  await requirePage('activity.read_crm')

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/companies'), { label: 'Activity' }]}
      tabs={COMPANIES_TABS}
      activeTab='activity'
      primaryAction={
        <SheetCreateButton entity='company' label='Create company' />
      }
    >
      <PagePanel>
        <ActivitySection
          targetType='COMPANY'
          emptyState='No recent company activity.'
          description='Audit company creation, edits, archives, and deletions in one place.'
        />
      </PagePanel>
    </PageShell>
  )
}
