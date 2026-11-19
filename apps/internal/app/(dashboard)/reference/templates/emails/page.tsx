import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { getEmailSender } from '@/lib/business/identity'
import { buildEmailTemplateCatalog } from '@/lib/email/catalog'

import { EmailsGallery } from '../_components/emails-gallery'

import {
  referenceCrumbs,
  referenceTabsFor,
} from '@/lib/navigation/reference-tabs'

export const metadata: Metadata = {
  title: 'Email templates | Reference',
}

export default async function EmailTemplatesPage() {
  const user = await requirePage('settings.templates')
  const entries = buildEmailTemplateCatalog(await getEmailSender())

  return (
    <PageShell
      breadcrumbs={referenceCrumbs('emails')}
      tabs={referenceTabsFor(user.role)}
      activeTab='emails'
      count={{ label: 'templates', total: entries.length }}
    >
      <EmailsGallery entries={entries} />
    </PageShell>
  )
}
