'use client'

import { useState } from 'react'

import type {
  EmailTemplateEntry,
  EmailTemplateGroup,
} from '@/lib/email/catalog'

import { EmailSheet } from './email-sheet'
import { HtmlThumbnail, TemplateCard } from './template-card'
import {
  EMPTY_TEMPLATE_FILTERS,
  matchesTemplateFilters,
  NoMatchingTemplates,
  TemplateFilters,
  TemplateSection,
} from './template-gallery-parts'
import { EMAIL_GROUP_LABELS } from './template-labels'
import { PagePanel } from '@/components/layout/page-panel'

/**
 * Read-only catalog of every outbound email as a gallery of live thumbnails,
 * one section per flow. Opening a card shows the full message in a sheet.
 */
export function EmailsGallery({ entries }: { entries: EmailTemplateEntry[] }) {
  const [filters, setFilters] = useState(EMPTY_TEMPLATE_FILTERS)
  const [openId, setOpenId] = useState<string | null>(null)
  // Kept after close so the sheet keeps its content while it slides out.
  const [shownId, setShownId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <PagePanel className='text-muted-foreground text-sm'>
        No email templates are registered.
      </PagePanel>
    )
  }

  const sections = groupEntries(
    entries.filter(entry =>
      matchesTemplateFilters(
        filters,
        entry.variants.map(variant => variant.audience),
        [
          entry.name,
          EMAIL_GROUP_LABELS[entry.group],
          ...entry.variants.map(variant => variant.sample.subject),
        ]
      )
    )
  )

  return (
    <PagePanel className='flex flex-col gap-6'>
      <TemplateFilters value={filters} onChange={setFilters} />

      {sections.length === 0 ? (
        <NoMatchingTemplates />
      ) : (
        sections.map(section => (
          <TemplateSection
            key={section.id}
            id={section.id}
            label={section.label}
            count={section.entries.length}
          >
            {section.entries.map(entry => (
              <li key={entry.id}>
                <TemplateCard
                  name={entry.name}
                  audiences={entry.variants.map(variant => variant.audience)}
                  notice={entry.status === 'disabled' ? 'Not sent' : undefined}
                  thumbnail={
                    entry.variants[0] ? (
                      <HtmlThumbnail html={entry.variants[0].sample.html} />
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
        ))
      )}

      <EmailSheet
        entry={entries.find(entry => entry.id === shownId) ?? null}
        open={openId !== null}
        onOpenChange={open => {
          if (!open) setOpenId(null)
        }}
      />
    </PagePanel>
  )
}

function groupEntries(entries: EmailTemplateEntry[]) {
  return (Object.keys(EMAIL_GROUP_LABELS) as EmailTemplateGroup[])
    .map(group => ({
      id: group,
      label: EMAIL_GROUP_LABELS[group],
      entries: entries.filter(entry => entry.group === group),
    }))
    .filter(section => section.entries.length > 0)
}
