import { currentBillingTypeSql } from '@pts/db/terms'
import { isClientCompany } from '@pts/db/client-state'
import 'server-only'

import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertCan } from '@/lib/auth/permissions'
import { roleCan } from '@/lib/auth/capabilities'
import { db } from '@/lib/db'
import { companies, contacts, projects } from '@/lib/db/schema'
import { createSearchPattern } from '@/lib/pagination/cursor'
import {
  companySheetHref,
  contactSheetHref,
  projectTasksHref,
} from '@/lib/sheets/hrefs'

import {
  PALETTE_RESULT_LIMIT,
  projectClientLabel,
  searchPaletteHourBlocks,
  searchPaletteInvoices,
  searchPaletteLeads,
  searchPaletteSubmissions,
  searchPaletteTasks,
  visibleProjectCondition,
} from './command-palette-records'
import type {
  PaletteRecord,
  PaletteSearchResult,
} from '@/lib/command-palette/types'

/**
 * ⌘K palette record search (PRD 004 §01, D13): every kind of record with a
 * sheet, each result opening it. Fuzzy semantics inherited from
 * `createSearchPattern` by design (W3). Admin-only (`portal.command_palette`),
 * so beyond R3 there are no per-record visibility rules.
 */
export async function searchCommandPalette(
  user: AppUser,
  query: string
): Promise<PaletteSearchResult> {
  assertCan(user, 'portal.command_palette')
  const pattern = createSearchPattern(query)

  const [
    companyResults,
    people,
    projectResults,
    leads,
    tasks,
    invoices,
    hourBlocks,
    submissions,
  ] = await Promise.all([
    searchCompanies(pattern),
    searchPeople(pattern, roleCan(user.role, 'settings.users')),
    searchProjects(pattern, user),
    searchPaletteLeads(pattern),
    searchPaletteTasks(pattern, user),
    searchPaletteInvoices(pattern),
    searchPaletteHourBlocks(pattern),
    searchPaletteSubmissions(pattern),
  ])

  return {
    companies: companyResults,
    people,
    leads,
    submissions,
    projects: projectResults,
    tasks,
    invoices,
    hourBlocks,
  }
}

/** Every live company; clients carry the client dot and their billing type. */
async function searchCompanies(pattern: string): Promise<PaletteRecord[]> {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      isClient: sql<boolean>`${isClientCompany()}`,
      billingType: sql<
        'prepaid' | 'net_30' | null
      >`case when ${isClientCompany()} then ${currentBillingTypeSql()} end`,
    })
    .from(companies)
    .where(
      and(isNull(companies.deletedAt), sql`${companies.name} ILIKE ${pattern}`)
    )
    .orderBy(asc(sql`lower(${companies.name})`))
    .limit(PALETTE_RESULT_LIMIT)

  return rows.map(row => ({
    id: row.id,
    title: row.name,
    detail: null,
    href: companySheetHref(row.id),
    entity: row.isClient ? 'client' : 'company',
    billingType: row.isClient ? row.billingType : null,
  }))
}

/**
 * People by name or email. The sign-in dot shows only to viewers who manage
 * sign-ins.
 */
async function searchPeople(
  pattern: string,
  seesSignIns: boolean
): Promise<PaletteRecord[]> {
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      hasSignIn: sql<boolean>`exists (
        select 1 from users u
        where u.id = ${sql.raw('"contacts"."user_id"')}
          and u.deleted_at is null and u.disabled_at is null
      )`,
    })
    .from(contacts)
    .where(
      and(
        isNull(contacts.deletedAt),
        or(
          sql`${contacts.name} ILIKE ${pattern}`,
          sql`${contacts.email} ILIKE ${pattern}`
        )
      )
    )
    .orderBy(asc(contacts.name))
    .limit(PALETTE_RESULT_LIMIT)

  return rows.map(row => ({
    id: row.id,
    title: row.name,
    detail: row.email,
    href: contactSheetHref(row.id),
    entity: seesSignIns && row.hasSignIn ? 'user' : 'contact',
  }))
}

/** Projects by name, slug or client name (R7); each opens its board. */
async function searchProjects(
  pattern: string,
  user: AppUser
): Promise<PaletteRecord[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      type: projects.type,
      clientName: companies.name,
      clientSlug: companies.slug,
    })
    .from(projects)
    .leftJoin(companies, eq(projects.companyId, companies.id))
    .where(
      and(
        isNull(projects.deletedAt),
        visibleProjectCondition(user),
        or(
          sql`${projects.name} ILIKE ${pattern}`,
          sql`${projects.slug} ILIKE ${pattern}`,
          sql`${companies.name} ILIKE ${pattern}`
        )
      )
    )
    .orderBy(asc(companies.name), asc(projects.name))
    .limit(PALETTE_RESULT_LIMIT)

  return rows.flatMap(row => {
    const href = projectTasksHref({
      projectSlug: row.slug,
      projectType: row.type,
      clientSlug: row.clientSlug,
    })
    if (!href) return []
    return [
      {
        id: row.id,
        title: row.name,
        detail: projectClientLabel(row.type, row.clientName),
        href,
        entity: 'project' as const,
      },
    ]
  })
}
