import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies, contacts } from '@/lib/db/schema'
import { joinCompany } from '@/lib/queries/memberships'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

/** The company staff people belong to. */
export const STAFF_COMPANY_NAME = 'Place To Stand'

/**
 * A sign-in always belongs to a person (one record per person, 0109): find
 * the contact for a new user and link it, or create one. Staff join the
 * Place To Stand company. A contact already linked to this user wins; else
 * an unlinked contact with the same email; else a new contact.
 */
export async function ensurePersonForUser(
  executor: Executor,
  input: {
    userId: string
    email: string
    fullName: string
    role: 'ADMIN' | 'SALES' | 'CLIENT'
  }
): Promise<string> {
  const [linked] = await executor
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.userId, input.userId), isNull(contacts.deletedAt)))
    .limit(1)

  let contactId = linked?.id ?? null
  if (!contactId) {
    const [byEmail] = await executor
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          sql`lower(${contacts.email}) = lower(${input.email})`,
          isNull(contacts.userId),
          isNull(contacts.deletedAt)
        )
      )
      .limit(1)
    if (byEmail) {
      await executor
        .update(contacts)
        .set({ userId: input.userId, updatedAt: new Date().toISOString() })
        .where(eq(contacts.id, byEmail.id))
      contactId = byEmail.id
    } else {
      const [created] = await executor
        .insert(contacts)
        .values({
          name: input.fullName,
          email: input.email,
          userId: input.userId,
        })
        .returning({ id: contacts.id })
      contactId = created?.id ?? null
    }
  }
  if (!contactId) throw new Error('Unable to create the person for this user.')

  if (input.role !== 'CLIENT') {
    const staffCompanyId = await findOrCreateStaffCompany(executor)
    await joinCompany(executor, contactId, staffCompanyId, {
      title: input.role === 'SALES' ? 'Sales' : 'Partner',
    })
  }
  return contactId
}

async function findOrCreateStaffCompany(executor: Executor): Promise<string> {
  const [existing] = await executor
    .select({ id: companies.id })
    .from(companies)
    .where(sql`lower(${companies.name}) = lower(${STAFF_COMPANY_NAME})`)
    .limit(1)
  if (existing) return existing.id
  const [created] = await executor
    .insert(companies)
    .values({ name: STAFF_COMPANY_NAME })
    .returning({ id: companies.id })
  if (!created) throw new Error('Unable to create the staff company.')
  return created.id
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
