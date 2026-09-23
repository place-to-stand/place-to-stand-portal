'use client'

import { useState } from 'react'

import type { PdfTemplateEntry } from '@/lib/pdf/catalog'

import { PdfSheet, pdfPreviewUrl } from './pdf-sheet'
import { PdfThumbnail, TemplateCard } from './template-card'
import {
  EMPTY_TEMPLATE_FILTERS,
  matchesTemplateFilters,
  NoMatchingTemplates,
  TemplateFilters,
  TemplateSection,
} from './template-gallery-parts'

/**
 * Read-only catalog of every PDF the apps render, in the same gallery and
 * sheet as the emails tab. The invoice is the only PDF, under Billing.
 */
export function PdfsGallery({ entries }: { entries: PdfTemplateEntry[] }) {
  const [filters, setFilters] = useState(EMPTY_TEMPLATE_FILTERS)
  const [openId, setOpenId] = useState<string | null>(null)
  // Kept after close so the sheet keeps its content while it slides out.
  const [shownId, setShownId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <section className='bg-background text-muted-foreground rounded-xl border p-6 text-sm shadow-sm'>
        No PDF templates are registered.
      </section>
    )
  }

  const visible = entries.filter(entry =>
    matchesTemplateFilters(filters, entry.audiences, [
      entry.name,
      entry.summary,
      entry.description,
    ])
  )

  return (
    <section className='bg-background flex flex-col gap-6 rounded-xl border p-4 shadow-sm'>
      <TemplateFilters value={filters} onChange={setFilters} />

      {visible.length === 0 ? (
        <NoMatchingTemplates />
      ) : (
        <TemplateSection id='billing' label='Billing' count={visible.length}>
          {visible.map(entry => (
            <li key={entry.id}>
              <TemplateCard
                name={entry.name}
                audiences={entry.audiences}
                thumbnail={
                  entry.variants[0] ? (
                    <PdfThumbnail
                      src={pdfPreviewUrl(entry.id, entry.variants[0].key)}
                    />
                  ) : null
                }
                onOpen={() => {
                  setShownId(entry.id)
                  setOpenId(entry.id)
                }}
              />
            </li>
          ))}
        </TemplateSection>
      )}

      <PdfSheet
        entry={entries.find(entry => entry.id === shownId) ?? null}
        open={openId !== null}
        onOpenChange={open => {
          if (!open) setOpenId(null)
        }}
      />
    </section>
  )
}
