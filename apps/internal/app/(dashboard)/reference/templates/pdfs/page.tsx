import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { buildPdfTemplateCatalog } from '@/lib/pdf/catalog'

import { PdfsGallery } from '../_components/pdfs-gallery'

import {
  referenceCrumbs,
  referenceTabsFor,
} from '@/lib/navigation/reference-tabs'

export const metadata: Metadata = {
  title: 'PDF templates | Reference',
}

export default async function PdfTemplatesPage() {
  const user = await requirePage('settings.templates')
  const entries = buildPdfTemplateCatalog()

  return (
    <PageShell
      breadcrumbs={referenceCrumbs('templates')}
      tabs={referenceTabsFor(user.role)}
      activeTab='templates'
      count={{ label: 'templates', total: entries.length }}
    >
      <PdfsGallery entries={entries} />
    </PageShell>
  )
}
