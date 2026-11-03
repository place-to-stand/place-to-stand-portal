import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'
import { COMPANIES_TABS } from '../_lib/tabs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { EntityActivityPage } from '@/components/activity/entity-activity-page'

export const metadata: Metadata = {
  title: 'Company activity',
}

export default async function CompaniesActivityPage() {
  await requirePage('activity.read_crm')

  return (
    <EntityActivityPage
      navHref='/companies'
      tabs={COMPANIES_TABS}
      primaryAction={
        <SheetCreateButton entity='company' label='Create company' />
      }
      targetType='COMPANY'
      emptyState='No recent company activity.'
      description='Audit company creation, edits, archives, and deletions in one place.'
    />
  )
}
