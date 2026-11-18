import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { getEmailSender } from '@/lib/business/identity'
import { buildEmailTemplateCatalog } from '@/lib/email/catalog'

import { EmailsGallery } from '../_components/emails-gallery'
import { helpCrumbs, helpTabsFor } from '@/lib/navigation/help-tabs'

export const metadata: Metadata = {
  title: 'Email templates | Help',
}

export default async function EmailTemplatesPage() {
  const user = await requirePage('settings.templates')
  const entries = buildEmailTemplateCatalog(await getEmailSender())

  return (
    <PageShell
      breadcrumbs={helpCrumbs('emails')}
      tabs={helpTabsFor(user.role)}
      activeTab='emails'
      count={{ label: 'templates', total: entries.length }}
    >
      <EmailsGallery entries={entries} />
    </PageShell>
  )
}
