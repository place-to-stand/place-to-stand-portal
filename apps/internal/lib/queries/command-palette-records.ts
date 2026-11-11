import 'server-only'

import { isClientCompany } from '@pts/db/client-state'
import { formatCalendarDate } from '@pts/ui/dates'
import { formatHours } from '@pts/ui/numbers'

import { and, desc, eq, isNull, ne, or, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  companies,
  formSubmissions,
  hourBlocks,
  invoices,
  leads,
  projects,
  tasks,
} from '@/lib/db/schema'
import { FORM_SUBMISSION_KIND_LABELS } from '@/lib/form-submissions/constants'
import {
  leadCompany,
  leadCompanyJoin,
  leadContact,
  leadContactJoin,
} from '@/lib/leads/lead-display'
import {
  hourBlockHref,
  invoiceHref,
  leadHref,
  leadTaskHref,
  projectTaskHref,
  submissionHref,
  taskSheetHref,
} from '@/lib/sheets/hrefs'

import type { PaletteRecord } from '@/lib/command-palette/types'

export const PALETTE_RESULT_LIMIT = 8

/**
 * Projects a viewer may see: PERSONAL ones only by their creator (R3), the
 * rule the retired combobox switcher applied. Tasks follow their project.
 */
export const visibleProjectCondition = (user: AppUser): SQL =>
  or(ne(projects.type, 'PERSONAL'), eq(projects.createdBy, user.id))!

/** "Internal" / "Personal" for those projects, else the client's name. */
export const projectClientLabel = (
  type: string,
  clientName: string | null
): string | null =>
  type === 'INTERNAL'
    ? 'Internal'
    : type === 'PERSONAL'
      ? 'Personal'
      : clientName

const ilike = (column: unknown, pattern: string) =>
  sql`${column} ILIKE ${pattern}`

const present = (...values: (string | null | undefined)[]) =>
  values.filter((value): value is string => Boolean(value?.trim()))

/** Leads by their person's name or email, or their company's name. */
export async function searchPaletteLeads(
  pattern: string
): Promise<PaletteRecord[]> {
  const rows = await db
    .select({
      id: leads.id,
      name: leadContact.name,
      email: leadContact.email,
      companyName: leadCompany.name,
    })
    .from(leads)
    .innerJoin(leadContact, leadContactJoin)
    .leftJoin(leadCompany, leadCompanyJoin)
    .where(
      and(
        isNull(leads.deletedAt),
        or(
          ilike(leadContact.name, pattern),
          ilike(leadContact.email, pattern),
          ilike(leadCompany.name, pattern)
        )
      )
    )
    .orderBy(desc(leads.updatedAt))
    .limit(PALETTE_RESULT_LIMIT)

  return rows.map(row => ({
    id: row.id,
    title: row.name,
    detail: row.companyName ?? row.email,
    href: leadHref(row.id),
    entity: 'lead',
    keywords: present(row.email),
  }))
}

/**
 * Tasks by title. A project task opens over its board, a lead task over its
 * lead. Tasks of archived projects or leads, or of PERSONAL projects the
 * viewer can't see, are left out.
 */
export async function searchPaletteTasks(
  pattern: string,
  user: AppUser
): Promise<PaletteRecord[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      projectName: projects.name,
      projectSlug: projects.slug,
      projectType: projects.type,
      // The board's URL takes the client slug only while the company is
      // billed; otherwise the task opens over the Projects list.
      clientSlug: sql<
        string | null
      >`case when ${isClientCompany()} then ${companies.slug} end`,
      leadId: leads.id,
      leadName: leadContact.name,
    })
    .from(tasks)
    .leftJoin(
      projects,
      and(eq(tasks.projectId, projects.id), isNull(projects.deletedAt))
    )
    .leftJoin(companies, eq(projects.companyId, companies.id))
    .leftJoin(leads, and(eq(tasks.leadId, leads.id), isNull(leads.deletedAt)))
    .leftJoin(leadContact, leadContactJoin)
    .where(
      and(
        isNull(tasks.deletedAt),
        ilike(tasks.title, pattern),
        or(
          and(sql`${projects.id} is not null`, visibleProjectCondition(user)),
          sql`${leads.id} is not null`
        )
      )
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(PALETTE_RESULT_LIMIT)

  return rows.flatMap(row => {
    const href = row.projectType
      ? projectTaskHref(
          {
            projectSlug: row.projectSlug,
            projectType: row.projectType,
            clientSlug: row.clientSlug,
          },
          row.id
        )
      : row.leadId
        ? leadTaskHref(row.leadId, row.id)
        : null
    if (!href && !row.projectType) return []
    return [
      {
        id: row.id,
        title: row.title,
        detail: row.projectType ? row.projectName : row.leadName,
        href: href ?? taskSheetHref(row.id),
        entity: 'task' as const,
      },
    ]
  })
}

/** Invoices by number or company name. Drafts have no number yet. */
export async function searchPaletteInvoices(
  pattern: string
): Promise<PaletteRecord[]> {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.invoiceNumber,
      companyName: companies.name,
    })
    .from(invoices)
    .innerJoin(companies, eq(invoices.companyId, companies.id))
    .where(
      and(
        isNull(invoices.deletedAt),
        or(
          ilike(invoices.invoiceNumber, pattern),
          ilike(companies.name, pattern)
        )
      )
    )
    .orderBy(desc(invoices.createdAt))
    .limit(PALETTE_RESULT_LIMIT)

  return rows.map(row => ({
    id: row.id,
    title: row.number ?? 'Draft invoice',
    detail: row.companyName,
    href: invoiceHref(row.id),
    entity: 'invoice',
  }))
}

/** Hour blocks by company name, newest billing month first. */
export async function searchPaletteHourBlocks(
  pattern: string
): Promise<PaletteRecord[]> {
  const rows = await db
    .select({
      id: hourBlocks.id,
      hours: hourBlocks.hoursPurchased,
      billingMonth: hourBlocks.billingMonth,
      companyName: companies.name,
    })
    .from(hourBlocks)
    .innerJoin(companies, eq(hourBlocks.companyId, companies.id))
    .where(and(isNull(hourBlocks.deletedAt), ilike(companies.name, pattern)))
    .orderBy(desc(hourBlocks.billingMonth))
    .limit(PALETTE_RESULT_LIMIT)

  return rows.map(row => ({
    id: row.id,
    title: row.companyName,
    detail: `${formatHours(row.hours)} · ${formatCalendarDate(row.billingMonth, { month: 'short', year: 'numeric' })}`,
    href: hourBlockHref(row.id),
    entity: 'hourBlock',
  }))
}

/** Website form submissions by name, email, company or subject, newest first. */
export async function searchPaletteSubmissions(
  pattern: string
): Promise<PaletteRecord[]> {
  const rows = await db
    .select({
      id: formSubmissions.id,
      kind: formSubmissions.kind,
      name: formSubmissions.contactName,
      email: formSubmissions.contactEmail,
      company: formSubmissions.contactCompany,
      subject: formSubmissions.subject,
    })
    .from(formSubmissions)
    .where(
      and(
        isNull(formSubmissions.deletedAt),
        // Tombstones (personal data stripped) are in no list.
        isNull(formSubmissions.destroyedAt),
        or(
          ilike(formSubmissions.contactName, pattern),
          ilike(formSubmissions.contactEmail, pattern),
          ilike(formSubmissions.contactCompany, pattern),
          ilike(formSubmissions.subject, pattern)
        )
      )
    )
    .orderBy(sql`${formSubmissions.lastActivityAt} desc nulls last`)
    .limit(PALETTE_RESULT_LIMIT)

  return rows.map(row => {
    const title = row.name?.trim() || row.email?.trim() || 'Anonymous'
    return {
      id: row.id,
      title,
      detail: present(FORM_SUBMISSION_KIND_LABELS[row.kind], row.company).join(
        ' · '
      ),
      href: submissionHref(row.id),
      entity: 'submission' as const,
      keywords: present(row.email, row.company, row.subject),
    }
  })
}
