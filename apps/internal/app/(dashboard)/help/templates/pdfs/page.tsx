import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { buildPdfTemplateCatalog } from '@/lib/pdf/catalog'

import { PdfsGallery } from '../_components/pdfs-gallery'
import { helpCrumbs, helpTabsFor } from '@/lib/navigation/help-tabs'

export const metadata: Metadata = {
  title: 'PDF templates | Help',
}

export default async function PdfTemplatesPage() {
  const user = await requirePage('settings.templates')
  const entries = buildPdfTemplateCatalog()

  return (
    <PageShell
      breadcrumbs={helpCrumbs('pdfs')}
      tabs={helpTabsFor(user.role)}
      activeTab='pdfs'
      count={{ label: 'templates', total: entries.length }}
    >
      <PdfsGallery entries={entries} />
    </PageShell>
  )
}
