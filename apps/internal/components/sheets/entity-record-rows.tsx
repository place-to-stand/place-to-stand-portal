'use client'

import type { ReactNode } from 'react'

import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { SheetRecordRow } from '@/components/sheets/sheet-record-row'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { ENTITY_ICONS } from '@/lib/entity-accents'

/**
 * One preview row per entity, with the entity's registry icon (ENTITY_ICONS),
 * so a person (or company, lead) looks
 * the same in every sheet list: the same icon, the same detail line, and a
 * click opens its sheet. Callers add only state (a note like "Pending save")
 * and actions.
 */

type RowExtras = {
  /** Replaces the default detail line (e.g. "Pending save"). */
  note?: ReactNode
  actions?: ReactNode
  /** False when the viewer can't open this record (non-admins and clients). */
  openable?: boolean
  className?: string
}

export function ContactRecordRow({
  contact,
  titleAddon,
  note,
  actions,
  openable = true,
  className,
}: RowExtras & {
  /** Shown after the name, e.g. the portal-account mark. */
  titleAddon?: ReactNode
  contact: {
    id: string
    name: string | null
    email?: string | null
    jobTitle?: string | null
  }
}) {
  const { open } = useSheetParams()
  const name = contact.name || contact.email || 'Unnamed person'
  return (
    <SheetRecordRow
      icon={ENTITY_ICONS.contact}
      title={
        titleAddon ? (
          <span className='flex items-center gap-1.5'>
            {name}
            {titleAddon}
          </span>
        ) : (
          name
        )
      }
      description={
        note ?? contact.jobTitle ?? (contact.name ? contact.email : null)
      }
      onOpen={openable ? () => open('contact', contact.id) : undefined}
      openLabel={`Open ${name}`}
      actions={actions}
      className={className}
    />
  )
}

export function CompanyRecordRow({
  company,
  titleAddon,
  note,
  actions,
  openable = true,
  className,
}: RowExtras & {
  company: { id: string; name: string }
  /** Shown after the name, e.g. the Client badge. */
  titleAddon?: ReactNode
}) {
  const { open } = useSheetParams()
  return (
    <SheetRecordRow
      icon={ENTITY_ICONS.company}
      title={
        titleAddon ? (
          <span className='flex items-center gap-1.5'>
            {company.name}
            {titleAddon}
          </span>
        ) : (
          company.name
        )
      }
      description={note}
      onOpen={openable ? () => open('company', company.id) : undefined}
      openLabel={`Open ${company.name}`}
      actions={actions}
      className={className}
    />
  )
}

export function LeadRecordRow({
  lead,
  note,
  actions,
  openable = true,
  className,
}: RowExtras & {
  lead: {
    id: string
    contactName: string
    status: LeadStatusValue
    assigneeName?: string | null
  }
}) {
  const { open } = useSheetParams()
  return (
    <SheetRecordRow
      icon={ENTITY_ICONS.lead}
      title={lead.contactName}
      description={note ?? lead.assigneeName}
      onOpen={openable ? () => open('lead', lead.id) : undefined}
      openLabel={`Open lead ${lead.contactName}`}
      actions={
        <>
          <span className='pr-1.5'>
            <LeadStatusBadge status={lead.status} />
          </span>
          {actions}
        </>
      }
      className={className}
    />
  )
}
