import { sql } from 'drizzle-orm'

import { clients, companies } from '@/lib/db/schema'

/**
 * A client's website: its company's (the company owns it), falling back to
 * the client's legacy copy. Needs `companies` joined on `clients.company_id`.
 */
export const clientWebsiteSql = sql<string | null>`coalesce(
  nullif(btrim(${companies.website}), ''),
  nullif(btrim(${clients.website}), '')
)`
