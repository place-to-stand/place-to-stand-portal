import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireCrmUser } from '@/lib/auth/session'

import { CONTACTS_TABS } from '../_lib/tabs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { ActivitySection } from '@/components/activity/activity-section'

export const metadata: Metadata = {
  title: 'People activity',
}

export default async function ContactsActivityPage() {
  await requireCrmUser()

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/people'), { label: 'Activity' }]}
      tabs={CONTACTS_TABS}
      activeTab='activity'
      primaryAction={
        <SheetCreateButton entity='contact' label='Create person' />
      }
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ActivitySection
          targetType='CONTACT'
          emptyState='No recent people activity.'
          description='Audit people creation, edits, archives, and deletions in one place.'
        />
      </section>
    </PageShell>
  )
}
