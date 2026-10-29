import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireCrmUser } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { COMPANIES_TABS } from '../_lib/tabs'
import { CompaniesActivitySection } from '../_components/companies-activity-section'
import { CompaniesAddButton } from '../_components/companies-add-button'

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
      primaryAction={<CompaniesAddButton />}
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <CompaniesActivitySection />
      </section>
    </PageShell>
  )
}
