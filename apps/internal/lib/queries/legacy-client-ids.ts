import 'server-only'

import { wasClientCompany } from '@pts/db/client-state'
import { and, eq, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { UUID_PATTERN } from '@pts/db/uuid'

/**
 * Migration 0111 folded clients into companies. The CLI and MCP keep
 * accepting a client's old id, for good (decided Oct 30): old activity rows
 * and saved links still carry them. This returns the company it became (from
 * archive_sales_tools.client_id_map, which is kept permanently), or the input
 * unchanged.
 */
export async function companyIdForLegacyClientId(id: string): Promise<string> {
  if (!UUID_PATTERN.test(id)) return id
  try {
    const [row] = await db.execute<{ company_id: string }>(
      sql`select company_id from archive_sales_tools.client_id_map where client_id = ${id} limit 1`
    )
    return row?.company_id ?? id
  } catch {
    // No map (a database made after 0111 was archived): nothing to translate.
    return id
  }
}

/**
 * The company an old `/clients/<slug or id>` link meant: a company that was
 * ever a client, by slug, or by id through the 0111 map. Null if none.
 */
export async function findClientCompanyForLegacyLink(
  slugOrId: string
): Promise<{ id: string } | null> {
  const id = UUID_PATTERN.test(slugOrId)
    ? await companyIdForLegacyClientId(slugOrId)
    : null
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        wasClientCompany(),
        id
          ? or(eq(companies.slug, slugOrId), eq(companies.id, id))
          : eq(companies.slug, slugOrId)
      )
    )
    .limit(1)
  return company ?? null
}
