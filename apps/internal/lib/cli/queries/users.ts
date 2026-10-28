import 'server-only'

import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'

import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { fetchCrmUsers } from '@/lib/data/users'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import { userFields, userSortExpression, type SelectUser } from '@/lib/queries/users/fields'

export type CliUserFilters = {
  search?: string
  role?: SelectUser['role']
  limit: number
}

/**
 * Admins list every active user. SALES staff list only the CRM staff the
 * portal shows them (`fetchCrmUsers`, the lead assignee picker).
 */
export async function listUsersForCli(
  user: AppUser,
  { search, role, limit }: CliUserFilters
): Promise<SelectUser[]> {
  assertCrmAccess(user)

  const conditions = [isNull(users.deletedAt), isNull(users.disabledAt)]

  if (user.role !== 'ADMIN') {
    const staff = [...(await crmUserIds())]

    if (!staff.length) {
      return []
    }

    conditions.push(inArray(users.id, staff))
  }

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

/** Ids of the staff the portal lets work leads and tasks (ADMIN, SALES). */
async function crmUserIds(): Promise<Set<string>> {
  return new Set((await fetchCrmUsers()).map(member => member.id))
}

/**
 * Match UUID / email references against active users, optionally only those
 * in `allowed`. Throws `notFound(reference)` for the first one that does not
 * resolve, so a mistyped address fails loudly rather than quietly dropping.
 * An existing user outside `allowed` reads the same as no user, so the lookup
 * cannot be used to probe who exists.
 */
async function matchUserReferences(
  references: string[],
  allowed: Set<string> | null,
  notFound: (reference: string) => string
): Promise<string[]> {
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

  const visible = allowed ? rows.filter(row => allowed.has(row.id)) : rows

  const byId = new Map(visible.map(row => [row.id, row.id]))
  const byEmail = new Map(visible.map(row => [row.email.toLowerCase(), row.id]))

  return unique.map(reference => {
    const resolved = reference.includes('@')
      ? byEmail.get(reference.toLowerCase())
      : byId.get(reference)

    if (!resolved) {
      throw new NotFoundError(notFound(reference))
    }

    return resolved
  })
}

/**
 * Resolve user references for read filters (an owner, assignee, actor or
 * person to filter by). Each reference is a UUID or an email address — agents
 * and humans both reach for the email.
 *
 * Admins resolve any active user. SALES staff resolve only the CRM staff the
 * portal shows them (`fetchCrmUsers`, the lead assignee picker).
 *
 * Never use this for a write: assignments go through `resolveAssigneeIds`.
 */
export async function resolveUserIds(
  user: AppUser,
  references: string[]
): Promise<string[]> {
  assertCrmAccess(user)

  return matchUserReferences(
    references,
    user.role === 'ADMIN' ? null : await crmUserIds(),
    reference => `No active user matches "${reference}".`
  )
}

/**
 * Resolve the users to assign to a task or lead. Only staff can be assigned —
 * the CRM staff set (`fetchCrmUsers`: ADMIN, SALES), whatever the caller's
 * role — so no channel can assign a CLIENT (portal) user to anything.
 */
export async function resolveAssigneeIds(
  user: AppUser,
  references: string[]
): Promise<string[]> {
  assertCrmAccess(user)

  return matchUserReferences(
    references,
    await crmUserIds(),
    reference =>
      `No assignable staff user matches "${reference}". Only admin and sales users can be assigned.`
  )
}
