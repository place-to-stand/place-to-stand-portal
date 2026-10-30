import { clientNameSql } from '@pts/db/names'
import 'server-only'

import { asc, eq, and, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clientPortalAccess, clients, contacts } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

import {
  listContactMemberships,
  type ContactMembership,
} from '@/lib/queries/memberships'

import { contactProfileFields, type ContactProfile } from '../selectors'

export type ClientOption = {
  id: string
  name: string
  slug: string
}

export type ContactSheetInputRow = ContactProfile & {
  id: string
  email: string | null
  name: string
  phone: string | null
  /** Portal user this contact was promoted to — drives the Portal access card. */
  userId: string | null
}

/** Sheet row plus the archive flag the deep-link resolver needs. */
export type ContactDeepLinkRow = ContactSheetInputRow & {
  deletedAt: string | null
}

export type ContactSheetData = {
  /** Their current companies, main company first. */
  memberships: ContactMembership[]
}

/** Fetches all active clients (contacts client filter, MCP directory). */
export async function listAllActiveClients(
  user: AppUser
): Promise<ClientOption[]> {
  assertCrmAccess(user)

  const rows = await db
    .select({
      id: clients.id,
      name: clientNameSql,
      slug: clients.slug,
    })
    .from(clients)
    .where(sql`${clients.deletedAt} IS NULL`)
    .orderBy(asc(clientNameSql))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug ?? row.id,
  }))
}

/**
 * Fetches the clients linked to a specific contact.
 */
export async function listContactClients(
  user: AppUser,
  contactId: string
): Promise<ClientOption[]> {
  assertCrmAccess(user)

  const rows = await db
    .select({
      id: clients.id,
      name: clientNameSql,
      slug: clients.slug,
    })
    .from(clientPortalAccess)
    .innerJoin(clients, eq(clientPortalAccess.clientId, clients.id))
    .where(
      and(
        eq(clientPortalAccess.contactId, contactId),
        sql`${clients.deletedAt} IS NULL`
      )
    )
    .orderBy(asc(clientNameSql))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug ?? row.id,
  }))
}

/** The contact sheet's Companies list (title, primary, portal access). */
export async function getContactSheetData(
  user: AppUser,
  contactId: string
): Promise<ContactSheetData> {
  assertCrmAccess(user)

  const byContact = await listContactMemberships([contactId], undefined, {
    includeArchived: true,
  })
  return { memberships: byContact.get(contactId) ?? [] }
}

/**
 * Fetches the minimal contact row the contact sheet needs — it self-fetches
 * its client links via `getContactSheetData`.
 */
export async function getContactSheetInputById(
  user: AppUser,
  contactId: string
): Promise<ContactSheetInputRow> {
  assertCrmAccess(user)

  const rows = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      phone: contacts.phone,
      userId: contacts.userId,
      ...contactProfileFields,
    })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), sql`${contacts.deletedAt} IS NULL`))
    .limit(1)

  if (!rows.length) {
    throw new NotFoundError('Person not found')
  }

  return rows[0]!
}

/**
 * By-id fetch that keeps archived contacts — the `?contact=` deep-link
 * resolver needs the soft-deleted row (and its `deletedAt`) so a shared link
 * can cross-redirect to the archive tab instead of reporting a dead link.
 */
export async function getContactDeepLinkRowById(
  user: AppUser,
  contactId: string
): Promise<ContactDeepLinkRow | null> {
  assertCrmAccess(user)

  const rows = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      phone: contacts.phone,
      userId: contacts.userId,
      deletedAt: contacts.deletedAt,
      ...contactProfileFields,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1)

  return rows[0] ?? null
}
