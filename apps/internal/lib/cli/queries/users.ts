import 'server-only'

import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'

import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import { userFields, userSortExpression, type SelectUser } from '@/lib/queries/users/fields'

export type CliUserFilters = {
  search?: string
  role?: SelectUser['role']
  limit: number
}

export async function listUsersForCli(
  user: AppUser,
  { search, role, limit }: CliUserFilters
): Promise<SelectUser[]> {
  assertAdmin(user)

  const conditions = [isNull(users.deletedAt), isNull(users.disabledAt)]

  if (role) {
    conditions.push(eq(users.role, role))
  }

  if (search) {
    const pattern = `%${search}%`
    const match = or(ilike(users.email, pattern), ilike(users.fullName, pattern))

    if (match) {
      conditions.push(match)
    }
  }

  return db
    .select(userFields)
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(userSortExpression))
    .limit(limit)
}

/**
 * Resolve assignee references to user ids. Each reference is either a UUID or
 * an email address — agents and humans both reach for the email, and requiring
 * a UUID means a database trip before every assignment.
 *
 * Throws rather than silently dropping: assigning to a mistyped address should
 * fail loudly, not quietly leave the task unassigned.
 */
export async function resolveUserIds(
  user: AppUser,
  references: string[]
): Promise<string[]> {
  assertAdmin(user)

  if (!references.length) {
    return []
  }

  const unique = Array.from(new Set(references.map(entry => entry.trim())))
  const emails = unique.filter(entry => entry.includes('@'))
  const ids = unique.filter(entry => !entry.includes('@'))

  const conditions = []

  if (ids.length) {
    conditions.push(inArray(users.id, ids))
  }

  if (emails.length) {
    conditions.push(
      inArray(sql`lower(${users.email})`, emails.map(email => email.toLowerCase()))
    )
  }

  const match = or(...conditions)

  const rows = match
    ? await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(match, isNull(users.deletedAt), isNull(users.disabledAt)))
    : []

  const byId = new Map(rows.map(row => [row.id, row.id]))
  const byEmail = new Map(rows.map(row => [row.email.toLowerCase(), row.id]))

  return unique.map(reference => {
    const resolved = reference.includes('@')
      ? byEmail.get(reference.toLowerCase())
      : byId.get(reference)

    if (!resolved) {
      throw new NotFoundError(`No active user matches "${reference}".`)
    }

    return resolved
  })
}
