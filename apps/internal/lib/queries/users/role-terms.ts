import 'server-only'

import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'

import type { DbTx } from '@/lib/db'
import { userRoleTerms, users } from '@/lib/db/schema'
import {
  currentMonthStartUtc,
  nextMonthStartUtc,
} from '@/lib/queries/clients/billing-terms'
import { hasActiveSnapshotForDate } from '@/lib/queries/reports/close-snapshots'

/**
 * The month a new sign-in's first role term starts: this month, unless it
 * is already closed (a closed month's roles are fixed), then next month.
 */
export async function firstRoleTermStart(): Promise<string> {
  const thisMonth = currentMonthStartUtc()
  return (await hasActiveSnapshotForDate(thisMonth))
    ? nextMonthStartUtc()
    : thisMonth
}

/**
 * The sign-in's role in force for the month of `periodStart`: its newest
 * `user_role_terms` row on or before that month. Seeded from Oct 2025 (0113),
 * so every sign-in resolves for every month the close covers.
 */
export function roleAsOfSql(periodStart: string, userId: SQL | typeof users.id = users.id) {
  return sql<string | null>`user_role_as_of(${userId}, ${periodStart}::date)`
}

/**
 * A person or sign-in counts for a period unless archived before it began:
 * archived people stay in the months they worked, and drop out after.
 */
export function liveDuring(deletedAt: SQL | { name: string }, periodStart: string) {
  return sql`(${deletedAt} is null or ${deletedAt} >= ${periodStart}::date)`
}

/**
 * Record a sign-in's role from a month on (a month start). Re-setting the
 * same month replaces it. Write it in the same transaction as `users.role`
 * when the month is this one or earlier; every new sign-in gets one from
 * its first month.
 */
export async function setRoleTerm(
  tx: DbTx,
  input: {
    userId: string
    role: (typeof userRoleTerms.$inferInsert)['role']
    effectiveFrom: string
    createdBy: string | null
  }
) {
  const now = new Date().toISOString()
  await tx
    .update(userRoleTerms)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(userRoleTerms.userId, input.userId),
        eq(userRoleTerms.effectiveFrom, input.effectiveFrom),
        isNull(userRoleTerms.deletedAt)
      )
    )
  await tx.insert(userRoleTerms).values({
    userId: input.userId,
    role: input.role,
    effectiveFrom: input.effectiveFrom,
    createdBy: input.createdBy,
  })
}
