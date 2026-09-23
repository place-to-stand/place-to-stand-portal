import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { buildPdfTemplateCatalog } from '@/lib/pdf/catalog'

import { PdfsGallery } from '../_components/pdfs-gallery'
import { TEMPLATES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Templates | Settings',
}

export default function PdfTemplatesPage() {
  const entries = buildPdfTemplateCatalog()

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/settings/templates/emails')}
      tabs={TEMPLATES_TABS}
      activeTab='pdfs'
      count={{ label: 'templates', total: entries.length }}
    >
      <PdfsGallery entries={entries} />
    </PageShell>
  )
}
