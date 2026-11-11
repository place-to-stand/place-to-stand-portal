import { isClientCompany } from '@pts/db/client-state'
import 'server-only'

import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import type { SignInFilter } from '@/lib/people/filters'
import { canSeePortalAccess } from '@/lib/people/portal-visibility'

import { buildBaseConditions } from './conditions'
import type { ClientOption } from './contact-clients'
import { normalizeStatus, type StatusFilter } from './pagination'

/**
 * The People company filter's options: the companies of the people this tab
 * lists (its status, role and search), clients first, then by name. A company
 * is offered when picking it would list someone, so it matches the list's
 * own company filter. The picked company stays offered, so the filter can
 * still show it. The page checks `contacts.manage`.
 */
export async function listCompanyFilterOptions(
  user: AppUser,
  input: {
    status?: StatusFilter
    search?: string
    signIn?: SignInFilter
    companyId?: string
  } = {}
): Promise<ClientOption[]> {
  const seesAccess = canSeePortalAccess(user.role)
  // Someone this page lists works at the company, and (admins, for a
  // client) can see it in the portal: what the list's company filter
  // matches (buildClientCondition). Driven from the company's memberships,
  // with the client check outside the per-person test, so it stays linear.
  const company = sql.raw('"companies"."id"')
  const listed = buildBaseConditions(
    normalizeStatus(input.status),
    input.search?.trim() ?? '',
    null,
    seesAccess ? input.signIn : null
  )
  const listsSomeone = sql`exists (
    select 1
    from memberships m
    join contacts on contacts.id = m.contact_id
    where m.company_id = ${company}
      and m.ended_at is null
      and ${and(...listed)}
      ${
        seesAccess
          ? sql`and (not company_is_client(${company}) or exists (
              select 1 from client_portal_access cpa
              where cpa.contact_id = contacts.id and cpa.company_id = ${company}
            ))`
          : sql``
      }
  )`

  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      isClient: sql<boolean>`coalesce(${isClientCompany()}, false)`,
    })
    .from(companies)
    .where(
      and(
        isNull(companies.deletedAt),
        input.companyId
          ? or(listsSomeone, eq(companies.id, input.companyId))
          : listsSomeone
      )
    )
    .orderBy(desc(isClientCompany()), asc(companies.name))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug ?? row.id,
    isClient: row.isClient,
  }))
}
