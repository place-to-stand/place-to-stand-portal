import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

import { users } from '@/lib/db/schema'

/**
 * The sign-in's role in force for the month of `periodStart`: its newest
 * `user_role_terms` row on or before that month. Seeded from Oct 2025 (0113),
 * so every sign-in resolves for every month the close covers.
 */
export function roleAsOfSql(periodStart: string, userId: SQL | typeof users.id = users.id) {
  return sql<string | null>`(select urt.role from user_role_terms urt
    where urt.user_id = ${userId} and urt.deleted_at is null
      and urt.effective_from <= ${periodStart}::date
    order by urt.effective_from desc limit 1)`
}

/**
 * A person or sign-in counts for a period unless archived before it began:
 * archived people stay in the months they worked, and drop out after.
 */
export function liveDuring(deletedAt: SQL | { name: string }, periodStart: string) {
  return sql`(${deletedAt} is null or ${deletedAt} >= ${periodStart}::date)`
}
