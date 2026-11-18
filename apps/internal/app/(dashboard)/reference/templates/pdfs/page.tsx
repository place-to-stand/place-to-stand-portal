import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { buildPdfTemplateCatalog } from '@/lib/pdf/catalog'

import { PdfsGallery } from '../_components/pdfs-gallery'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { TEMPLATES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'PDF templates | Reference',
}

export default async function PdfTemplatesPage() {
  await requirePage('settings.templates')
  const entries = buildPdfTemplateCatalog()

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/reference/templates/emails')}
      tabs={TEMPLATES_TABS}
      activeTab='pdfs'
      count={{ label: 'templates', total: entries.length }}
    >
      <PdfsGallery entries={entries} />
    </PageShell>
  )
}
