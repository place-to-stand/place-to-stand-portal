import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

/**
 * What a company picker also searches besides the name, so a company is
 * found by what people remember about it: each person currently at it
 * ("Name · email", primary contact first), then each live project
 * ("Warm Intro · project"). The one that matched shows under the name.
 * Select it from a query over `companies` (unaliased: the subquery names it).
 */
export const companySearchHintsSql = (): SQL<string[]> => sql<
  string[]
>`coalesce((
  select array_agg(hint order by rank, sort)
  from (
    select concat_ws(' · ', c.name, c.email) as hint,
      case when m.is_primary then 0 else 1 end as rank,
      c.name as sort
    from memberships m
    join contacts c on c.id = m.contact_id
    where m.company_id = "companies"."id"
      and m.ended_at is null
      and c.deleted_at is null
    union all
    select p.name || ' · project', 2, p.name
    from projects p
    where p.company_id = "companies"."id"
      and p.deleted_at is null
  ) hints
), '{}')`
