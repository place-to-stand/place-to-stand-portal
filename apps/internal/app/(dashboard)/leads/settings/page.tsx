import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requireRole } from '@/lib/auth/session'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { listLeadStageSettings } from '@/lib/queries/lead-stage-settings'

import { LEADS_TABS } from '../_lib/tabs'
import { FollowUpCadenceSection } from './_components/follow-up-cadence-section'

export const metadata: Metadata = {
  title: 'Lead Settings',
}

export default async function LeadSettingsPage() {
  const user = await requireRole('ADMIN')
  const thresholds = await listLeadStageSettings(user)

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/leads'), { label: 'Settings' }]}
      tabs={LEADS_TABS}
      activeTab='settings'
    >
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <FollowUpCadenceSection initialThresholds={thresholds} />
      </section>
    </PageShell>
  )
}
