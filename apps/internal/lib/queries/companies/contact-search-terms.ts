import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

/**
 * Names and emails of the people currently at a company (primary contact
 * first), one "Name email" string each: what a company picker also searches,
 * so typing a contact's name finds their company. Select it from a query
 * over `companies` (unaliased: the subquery names it).
 */
export const companyContactSearchTermsSql = (): SQL<string[]> => sql<
  string[]
>`coalesce((
  select array_agg(concat_ws(' ', c.name, c.email) order by m.is_primary desc, c.name)
  from memberships m
  join contacts c on c.id = m.contact_id
  where m.company_id = "companies"."id"
    and m.ended_at is null
    and c.deleted_at is null
), '{}')`
