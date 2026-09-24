import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { buildEmailTemplateCatalog } from '@/lib/email/catalog'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { EmailsGallery } from '../_components/emails-gallery'
import { TEMPLATES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Templates | Settings',
}

export default function EmailTemplatesPage() {
  const entries = buildEmailTemplateCatalog()

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/settings/templates/emails')}
      tabs={TEMPLATES_TABS}
      activeTab='emails'
      count={{ label: 'templates', total: entries.length }}
    >
      <EmailsGallery entries={entries} />
    </PageShell>
  )
}
