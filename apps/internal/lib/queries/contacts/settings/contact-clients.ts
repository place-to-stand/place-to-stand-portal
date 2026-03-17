'use server'

import { asc, eq, and, sql, inArray } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, contactClients } from '@/lib/db/schema'

export type ClientOption = {
  id: string
  name: string
  slug: string
}

export type ContactSheetData = {
  allClients: ClientOption[]
  linkedClients: ClientOption[]
}

/**
 * Fetches all active clients for use in the contact sheet client picker.
 */
export async function listAllActiveClients(
  user: AppUser
): Promise<ClientOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      slug: clients.slug,
    })
    .from(clients)
    .where(sql`${clients.deletedAt} IS NULL`)
    .orderBy(asc(clients.name))

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
  assertAdmin(user)

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      slug: clients.slug,
    })
    .from(contactClients)
    .innerJoin(clients, eq(contactClients.clientId, clients.id))
    .where(
      and(
        eq(contactClients.contactId, contactId),
        sql`${clients.deletedAt} IS NULL`
      )
    )
    .orderBy(asc(clients.name))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug ?? row.id,
  }))
}

/**
 * Links a client to a contact.
 */
export async function linkClientToContact(
  user: AppUser,
  contactId: string,
  clientId: string
): Promise<{ ok: boolean; error?: string }> {
  assertAdmin(user)

  try {
    await db.insert(contactClients).values({
      contactId,
      clientId,
    })
    return { ok: true }
  } catch (error) {
    // Handle unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes('unique constraint')
    ) {
      return { ok: true } // Already linked, treat as success
    }
    return { ok: false, error: 'Failed to link client to contact.' }
  }
}

/**
 * Unlinks a client from a contact.
 */
export async function unlinkClientFromContact(
  user: AppUser,
  contactId: string,
  clientId: string
): Promise<{ ok: boolean; error?: string }> {
  assertAdmin(user)

  try {
    await db
      .delete(contactClients)
      .where(
        and(
          eq(contactClients.contactId, contactId),
          eq(contactClients.clientId, clientId)
        )
      )
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to unlink client from contact.' }
  }
}

/**
 * Fetches all data needed for the contact sheet client picker.
 * If contactId is provided, also fetches the contact's linked clients.
 */
export async function getContactSheetData(
  user: AppUser,
  contactId?: string
): Promise<ContactSheetData> {
  assertAdmin(user)

  const [allClients, linkedClients] = await Promise.all([
    listAllActiveClients(user),
    contactId ? listContactClients(user, contactId) : Promise.resolve([]),
  ])

  return { allClients, linkedClients }
}

/**
 * Syncs the client links for a contact.
 * Adds new links and removes unlinked ones.
 */
export async function syncContactClients(
  user: AppUser,
  contactId: string,
  clientIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  assertAdmin(user)

  try {
    // Get current links
    const currentLinks = await db
      .select({ clientId: contactClients.clientId })
      .from(contactClients)
      .where(eq(contactClients.contactId, contactId))

    const currentIds = new Set(currentLinks.map(l => l.clientId))
    const newIds = new Set(clientIds)

    // Find links to add and remove
    const toAdd = clientIds.filter(id => !currentIds.has(id))
    const toRemove = [...currentIds].filter(id => !newIds.has(id))

    // Perform the updates
    if (toAdd.length > 0) {
      await db.insert(contactClients).values(
        toAdd.map(clientId => ({
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
            eq(contactClients.contactId, contactId),
            inArray(contactClients.clientId, toRemove)
          )
        )
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to update client links.' }
  }
}
