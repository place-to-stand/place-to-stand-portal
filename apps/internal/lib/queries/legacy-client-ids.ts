import 'server-only'

import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
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
