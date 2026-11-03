import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'
import { CONTACTS_TABS } from '../_lib/tabs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { EntityActivityPage } from '@/components/activity/entity-activity-page'

export const metadata: Metadata = {
  title: 'People activity',
}

export default async function ContactsActivityPage() {
  await requirePage('activity.read_crm')

  return (
    <EntityActivityPage
      navHref='/people'
      tabs={CONTACTS_TABS}
      primaryAction={
        <SheetCreateButton entity='contact' label='Create person' />
      }
      targetType='CONTACT'
      emptyState='No recent people activity.'
      description='Audit people creation, edits, archives, and deletions in one place.'
    />
  )
}
