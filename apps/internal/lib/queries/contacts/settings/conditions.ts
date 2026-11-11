import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

import type { SignInFilter } from '@/lib/people/filters'

import {
  buildClientCondition,
  buildSearchCondition,
  buildStatusCondition,
  type StatusFilter,
} from './pagination'

/**
 * People with (or without) a live sign-in, optionally of one role. Live means
 * not archived and not turned off, as in the Role column.
 */
function buildSignInCondition(signIn: SignInFilter | null | undefined) {
  if (!signIn) return null
  // The outer contact column is written table-qualified: interpolated, drizzle
  // may drop the table name and it would bind inside the subquery.
  const live = sql`exists (select 1 from users u where u.id = ${sql.raw('"contacts"."user_id"')} and u.deleted_at is null and u.disabled_at is null${
    signIn === 'any' || signIn === 'none' ? sql`` : sql` and u.role = ${signIn}`
  })`
  return signIn === 'none' ? sql`not ${live}` : live
}

export function buildBaseConditions(
  status: StatusFilter,
  searchQuery: string,
  /** A company id, or a column for a query over companies. */
  clientCompanyId: string | SQL | null | undefined,
  signIn?: SignInFilter | null,
  clientMatch: 'portal' | 'member' = 'portal'
): SQL[] {
  const conditions: SQL[] = [buildStatusCondition(status)]

  const searchCondition = buildSearchCondition(searchQuery)
  if (searchCondition) {
    conditions.push(searchCondition)
  }

  const clientCondition = buildClientCondition(clientCompanyId, clientMatch)
  if (clientCondition) {
    conditions.push(clientCondition)
  }

  const signInCondition = buildSignInCondition(signIn)
  if (signInCondition) {
    conditions.push(signInCondition)
  }

  return conditions
}
