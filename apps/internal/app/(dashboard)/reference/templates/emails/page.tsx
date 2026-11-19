import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { getEmailSender } from '@/lib/business/identity'
import { buildEmailTemplateCatalog } from '@/lib/email/catalog'

import { EmailsGallery } from '../_components/emails-gallery'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { TEMPLATES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Email templates | Reference',
}

export default async function EmailTemplatesPage() {
  await requirePage('settings.templates')
  const entries = buildEmailTemplateCatalog(await getEmailSender())

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/reference/templates/emails')}
      tabs={TEMPLATES_TABS}
      activeTab='emails'
      count={{ label: 'templates', total: entries.length }}
    >
      <EmailsGallery entries={entries} />
    </PageShell>
  )
}
