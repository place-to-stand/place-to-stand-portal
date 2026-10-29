import { sql } from 'drizzle-orm'

/**
 * A lead's website, read from its company (which owns it), falling back to
 * the lead's legacy copy for a lead with no company or a company without
 * one. Raw SQL correlated with the outer, unaliased `leads` row.
 */
export const leadCompanyWebsiteSql = sql<string | null>`coalesce(
  (SELECT nullif(btrim(c.website), '') FROM companies c WHERE c.id = leads.company_id),
  nullif(btrim(leads.company_website), '')
)`
