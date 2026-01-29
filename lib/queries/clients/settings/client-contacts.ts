'use server'

import { asc, eq, and, inArray, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { contacts, contactClients } from '@/lib/db/schema'

export type ContactOption = {
  id: string
  name: string | null
  email: string
  phone: string | null
}

export type ClientSheetContactData = {
  allContacts: ContactOption[]
  linkedContacts: ContactOption[]
}

/**
 * Fetches all active contacts for use in the client sheet contact picker.
 */
export async function listAllActiveContacts(
  user: AppUser
): Promise<ContactOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(asc(contacts.name), asc(contacts.email))

  return rows
}

/**
 * Fetches the contacts linked to a specific client.
 */
export async function listClientContacts(
  user: AppUser,
  clientId: string
): Promise<ContactOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
    })
    .from(contactClients)
    .innerJoin(contacts, eq(contactClients.contactId, contacts.id))
    .where(
      and(
        eq(contactClients.clientId, clientId),
        isNull(contacts.deletedAt)
      )
    )
    .orderBy(asc(contacts.name), asc(contacts.email))

  return rows
}

/**
 * Fetches all data needed for the client sheet contact picker.
 * If clientId is provided, also fetches the client's linked contacts.
 */
export async function getClientSheetContactData(
  user: AppUser,
  clientId?: string
): Promise<ClientSheetContactData> {
  assertAdmin(user)

  const [allContacts, linkedContacts] = await Promise.all([
    listAllActiveContacts(user),
    clientId ? listClientContacts(user, clientId) : Promise.resolve([]),
  ])

  return { allContacts, linkedContacts }
}

/**
 * Syncs the contact links for a client.
 * Adds new links and removes unlinked ones.
 */
export async function syncClientContacts(
  user: AppUser,
  clientId: string,
  contactIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  assertAdmin(user)

  try {
    // Get current links
    const currentLinks = await db
      .select({ contactId: contactClients.contactId })
      .from(contactClients)
      .where(eq(contactClients.clientId, clientId))

    const currentIds = new Set(currentLinks.map(l => l.contactId))
    const newIds = new Set(contactIds)

    // Find links to add and remove
    const toAdd = contactIds.filter(id => !currentIds.has(id))
    const toRemove = [...currentIds].filter(id => !newIds.has(id))

    // Perform the updates
    if (toAdd.length > 0) {
      await db.insert(contactClients).values(
        toAdd.map(contactId => ({
          contactId,
          clientId,
        }))
      )
    }

    if (toRemove.length > 0) {
      await db
        .delete(contactClients)
        .where(
          and(
            eq(contactClients.clientId, clientId),
            inArray(contactClients.contactId, toRemove)
          )
        )
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to update contact links.' }
  }
}
