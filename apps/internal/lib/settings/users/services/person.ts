import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies, contacts } from '@/lib/db/schema'
import { joinCompany, leaveCompany } from '@/lib/queries/memberships'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx
type Role = 'ADMIN' | 'SALES' | 'CLIENT'

/** The name the staff company gets if it has to be created. */
const STAFF_COMPANY_NAME = 'Place To Stand'

const isStaffRole = (role: Role | null | undefined) =>
  role === 'ADMIN' || role === 'SALES'

/**
 * The agency's own company (`companies.is_staff`), if there is one, archived
 * or not: an archived staff company is still the staff company, so a role
 * change never inserts a second one.
 */
async function findStaffCompany(
  executor: Executor
): Promise<{ id: string; archived: boolean } | null> {
  const [existing] = await executor
    .select({ id: companies.id, deletedAt: companies.deletedAt })
    .from(companies)
    .where(eq(companies.isStaff, true))
    .orderBy(sql`${companies.deletedAt} is not null`)
    .limit(1)
  return existing
    ? { id: existing.id, archived: existing.deletedAt !== null }
    : null
}

/**
 * The staff company, restored if archived, and created (marked `is_staff`)
 * only when none exists.
 */
async function findOrCreateStaffCompany(executor: Executor): Promise<string> {
  const existing = await findStaffCompany(executor)
  if (existing) {
    if (existing.archived) {
      await executor
        .update(companies)
        .set({ deletedAt: null, updatedAt: new Date().toISOString() })
        .where(eq(companies.id, existing.id))
    }
    return existing.id
  }
  const [created] = await executor
    .insert(companies)
    .values({ name: STAFF_COMPANY_NAME, isStaff: true })
    .returning({ id: companies.id })
  if (!created) throw new Error('Unable to create the staff company.')
  return created.id
}

/**
 * Keeps a person's staff-company membership in step with a role change:
 * becoming staff (Admin or Sales) joins it, with no title (their title is
 * their own job title, set on the sheet); becoming a client ends it.
 * Staying on the same side changes nothing.
 */
export async function syncStaffMembership(
  executor: Executor,
  contactId: string,
  from: Role | null,
  to: Role
): Promise<void> {
  if (isStaffRole(to) && !isStaffRole(from)) {
    const staffCompanyId = await findOrCreateStaffCompany(executor)
    await joinCompany(executor, contactId, staffCompanyId)
    return
  }
  if (!isStaffRole(to) && isStaffRole(from)) {
    const staffCompany = await findStaffCompany(executor)
    if (staffCompany) await leaveCompany(executor, contactId, staffCompany.id)
  }
}

/** Renames the person behind a sign-in (their contact holds the name). */
export async function renamePersonForUser(
  executor: Executor,
  userId: string,
  fullName: string
): Promise<void> {
  await executor
    .update(contacts)
    .set({ name: fullName.trim(), updatedAt: new Date().toISOString() })
    .where(and(eq(contacts.userId, userId), isNull(contacts.deletedAt)))
}
