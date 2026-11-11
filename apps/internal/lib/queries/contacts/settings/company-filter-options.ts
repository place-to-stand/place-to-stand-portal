import { isClientCompany } from '@pts/db/client-state'
import 'server-only'

import { and, asc, desc, eq, exists, isNull, or, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, contacts } from '@/lib/db/schema'
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
  // The same conditions as listContactsForSettings, with each company in turn
  // as the company filter. Raw and table-qualified so it binds to the outer
  // companies row inside the subquery.
  const listsSomeone = exists(
    db
      .select({ one: sql`1` })
      .from(contacts)
      .where(
        and(
          ...buildBaseConditions(
            normalizeStatus(input.status),
            input.search?.trim() ?? '',
            sql.raw('"companies"."id"'),
            seesAccess ? input.signIn : null,
            seesAccess ? 'portal' : 'member'
          )
        )
      )
  )

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
