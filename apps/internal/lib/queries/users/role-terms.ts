import 'server-only'

import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'

import { db } from '@/lib/db'
import { userRoleTerms, users } from '@/lib/db/schema'

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

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Record a sign-in's role from a month on (a month start). Re-setting the
 * same month replaces it. Write it in the same transaction as `users.role`
 * when the month is this one or earlier; every new sign-in gets one from
 * its first month.
 */
export async function setRoleTerm(
  tx: DbTransaction,
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
