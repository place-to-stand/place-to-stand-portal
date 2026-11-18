import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import {
  FORM_SECTIONS_CLASS,
  FormSection,
} from '@/components/forms/form-section'
import { CompanyServicesList } from '@/components/integrations/company-services-list'
import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'

import { SETTINGS_TABS, settingsCrumbs } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Integrations | Settings',
}

/**
 * The agency's own services. Each person's connections (Google, GitHub,
 * Vercel, Supabase, connected apps) are theirs, in Account → Integrations.
 */
export default async function IntegrationsSettingsPage() {
  await requirePage('integrations.manage')
  return (
    <PageShell
      breadcrumbs={settingsCrumbs('integrations')}
      tabs={SETTINGS_TABS}
      activeTab='integrations'
    >
      <PagePanel>
        <div className={FORM_SECTIONS_CLASS}>
          <FormSection
            title='Company'
            description='Shared by everyone. Set in the internal app’s Vercel environment, then redeploy. Your own accounts are under Account → Integrations.'
            layout='block'
          >
            <CompanyServicesList />
          </FormSection>
        </div>
      </PagePanel>
    </PageShell>
  )
}
