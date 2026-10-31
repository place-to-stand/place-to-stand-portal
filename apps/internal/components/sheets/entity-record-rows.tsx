'use client'

import type { ReactNode } from 'react'

import { InvoiceStatusBadge } from '@/app/(dashboard)/invoices/_components/invoice-status-badge'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { SheetRecordRow } from '@/components/sheets/sheet-record-row'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { formatCalendarDate } from '@pts/ui/dates'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { formatCurrency, formatHours } from '@pts/ui/numbers'
import { cn } from '@/lib/utils'

/**
 * One preview row per entity, with the entity's registry icon (ENTITY_ICONS),
 * so a person (or company, lead, project, invoice) looks
 * the same in every sheet list: the same icon, the same detail line, and a
 * click opens its sheet. Callers add only state (a note like "Pending save")
 * and actions.
 */

type RowExtras = {
  /** Replaces the default detail line (e.g. "Pending save"). */
  note?: ReactNode
  actions?: ReactNode
  /** Form fields on the record, on the card's second line (`RecordRowField`). */
  fields?: ReactNode
  /** False when the viewer can't open this record (non-admins and clients). */
  openable?: boolean
  className?: string
}

export function ContactRecordRow({
  contact,
  titleAddon,
  note,
  actions,
  fields,
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
          <span className='flex items-center gap-3'>
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
      fields={fields}
      className={className}
    />
  )
}

export function CompanyRecordRow({
  company,
  titleAddon,
  note,
  actions,
  fields,
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
          <span className='flex items-center gap-3'>
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
      fields={fields}
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

export function ProjectRecordRow({
  project,
  href,
  note,
  actions,
  className,
}: Omit<RowExtras, 'openable'> & {
  project: {
    id: string
    name: string
    status: string
    doneTasks?: number
    totalTasks?: number
  }
  /** Its board. Without one (no slug yet) the row is plain text. */
  href?: string | null
}) {
  const counts =
    project.totalTasks === undefined
      ? null
      : `${project.doneTasks ?? 0}/${project.totalTasks} tasks`
  return (
    <SheetRecordRow
      icon={ENTITY_ICONS.project}
      title={project.name}
      description={note ?? counts}
      href={href ?? undefined}
      openLabel={href ? `Open ${project.name}` : undefined}
      actions={
        <>
          <span className='pr-1.5'>
            <ProjectStatusBadge status={project.status} />
          </span>
          {actions}
        </>
      }
      className={className}
    />
  )
}

export function InvoiceRecordRow({
  invoice,
  note,
  actions,
  openable = true,
  className,
}: RowExtras & {
  invoice: {
    id: string
    number: string | null
    status: string | null
    total?: number | null
    issuedDate?: string | null
  }
}) {
  const { open } = useSheetParams()
  const title = invoice.number ?? 'Invoice'
  const details = [
    invoice.total == null ? null : formatCurrency(invoice.total),
    invoice.issuedDate
      ? `Issued ${formatCalendarDate(invoice.issuedDate)}`
      : null,
  ].filter(Boolean)
  return (
    <SheetRecordRow
      icon={ENTITY_ICONS.invoice}
      title={title}
      description={note ?? (details.length ? details.join(' · ') : null)}
      onOpen={openable ? () => open('invoice', invoice.id) : undefined}
      openLabel={`Open invoice ${title}`}
      actions={
        <>
          {invoice.status ? (
            <span className='pr-1.5'>
              <InvoiceStatusBadge status={invoice.status} />
            </span>
          ) : null}
          {actions}
        </>
      }
      className={className}
    />
  )
}

/**
 * An hour block: its name (the invoice line that bought it, else "Hour
 * block"), with hours and amount on the detail line. The icon carries the
 * hour block colour.
 */
export function HourBlockRecordRow({
  hourBlock,
  note,
  actions,
  openable = true,
  className,
}: RowExtras & {
  hourBlock: {
    id: string
    name?: string | null
    hours: number
    amount?: number | null
  }
}) {
  const { open } = useSheetParams()
  const title = hourBlock.name || 'Hour block'
  const details = [
    formatHours(hourBlock.hours),
    hourBlock.amount == null ? null : formatCurrency(hourBlock.amount),
  ].filter(Boolean)
  return (
    <SheetRecordRow
      leading={
        <ENTITY_ICONS.hourBlock
          className={cn(ENTITY_ACCENTS.hourBlock.icon, 'size-4')}
          aria-hidden
        />
      }
      title={title}
      description={note ?? details.join(' · ')}
      onOpen={openable ? () => open('hour-block', hourBlock.id) : undefined}
      openLabel={`Open hour block ${title}`}
      actions={actions}
      className={className}
    />
  )
}
