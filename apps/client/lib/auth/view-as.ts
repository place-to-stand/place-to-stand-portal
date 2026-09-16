import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientMembers, clients, contactClients, contacts } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'

/**
 * Cookie holding the client an ADMIN is currently previewing the portal as.
 *
 * SECURITY: this cookie carries no authority of its own. It is read only after
 * the caller has been confirmed to be an ADMIN via their database role, and it
 * can only ever *narrow* an admin from "all clients" to one client. For a
 * CLIENT user it is never read at all, so forging it is inert rather than
 * merely rejected.
 */
export const VIEW_AS_COOKIE = 'pts_view_as_client'

/**
 * Cookie holding the contact an ADMIN is currently previewing the portal as.
 *
 * When set, the portal is scoped to all clients linked to that contact via
 * contact_clients. Takes precedence over VIEW_AS_COOKIE.
 */
export const VIEW_AS_CONTACT_COOKIE = 'pts_view_as_contact'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PortalClientOption = {
  id: string
  name: string
}

export type PortalContactOption = {
  id: string
  name: string
  email: string
  /** True when the contact has a portal user account (userId IS NOT NULL). */
  isPromoted: boolean
}

export type PortalScope = {
  /** Clients whose data this request may touch. Empty means show nothing. */
  clientIds: string[]
  /** The same clients, with names, for display in the header. */
  scopedClients: PortalClientOption[]
  /** True when an admin has a valid contact selected. */
  isAdminPreview: boolean
  viewingAsClientId: string | null
  /** The contact the admin is currently previewing as (null if none selected). */
  viewingAsContactId: string | null
}

const EMPTY_ADMIN_SCOPE: PortalScope = {
  clientIds: [],
  scopedClients: [],
  isAdminPreview: false,
  viewingAsClientId: null,
  viewingAsContactId: null,
}

/**
 * The single place that answers "which clients is this request scoped to?".
 *
 * Every portal query derives its client scope from here. Do not reintroduce
 * ad-hoc `isAdmin(user) ? [] : <membership query>` branches elsewhere — the
 * drift between copies is the risk this exists to remove.
 */
export const resolvePortalScope = cache(
  async (user: AppUser): Promise<PortalScope> => {
    if (isAdmin(user)) {
      return resolveAdminScope()
    }

    const memberships = await db
      .select({ id: clients.id, name: clients.name })
      .from(clientMembers)
      .innerJoin(clients, eq(clients.id, clientMembers.clientId))
      .where(
        and(
          eq(clientMembers.userId, user.id),
          isNull(clientMembers.deletedAt),
          isNull(clients.deletedAt)
        )
      )
      .orderBy(asc(clients.name))

    return {
      clientIds: memberships.map(m => m.id),
      scopedClients: memberships,
      isAdminPreview: false,
      viewingAsClientId: null,
      viewingAsContactId: null,
    }
  }
)

/**
 * Every contact an admin may preview as — the list behind the ViewAsBanner
 * dropdown. Only the portal layout needs it, so it is deliberately NOT part of
 * resolvePortalScope: the scope resolution runs on every page render (and
 * every Link prefetch), and loading the whole contacts table there was a
 * full-table query per navigation for admins.
 */
export const fetchPortalContactOptions = cache(
  async (user: AppUser): Promise<PortalContactOption[]> => {
    if (!isAdmin(user)) return []

    return db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        // mapWith(Boolean): isNotNull is SQL<unknown>, and the postgres driver
        // hands the flag back as a real boolean.
        isPromoted: isNotNull(contacts.userId).mapWith(Boolean),
      })
      .from(contacts)
      .where(isNull(contacts.deletedAt))
      .orderBy(asc(contacts.name))
  }
)

async function resolveAdminScope(): Promise<PortalScope> {
  const cookieStore = await cookies()
  const selectedContactId = cookieStore.get(VIEW_AS_CONTACT_COOKIE)?.value ?? null

  // Fail closed: an admin with no selection sees an empty portal.
  if (!selectedContactId || !UUID_RE.test(selectedContactId)) {
    return EMPTY_ADMIN_SCOPE
  }

  // One round trip resolves both questions: does the contact still exist, and
  // which live clients is it linked to? Zero rows means the contact is gone
  // (fail closed); rows with a null client mean a valid contact with nothing
  // linked yet, which is still a valid preview.
  const rows = await db
    .select({ clientId: clients.id, clientName: clients.name })
    .from(contacts)
    .leftJoin(contactClients, eq(contactClients.contactId, contacts.id))
    .leftJoin(
      clients,
      and(eq(clients.id, contactClients.clientId), isNull(clients.deletedAt))
    )
    .where(and(eq(contacts.id, selectedContactId), isNull(contacts.deletedAt)))
    .orderBy(asc(clients.name))

  if (rows.length === 0) {
    return EMPTY_ADMIN_SCOPE
  }

  const linkedClients: PortalClientOption[] = []
  for (const row of rows) {
    if (row.clientId && row.clientName) {
      linkedClients.push({ id: row.clientId, name: row.clientName })
    }
  }

  return {
    clientIds: linkedClients.map(c => c.id),
    scopedClients: linkedClients,
    isAdminPreview: true,
    viewingAsClientId: null,
    viewingAsContactId: selectedContactId,
  }
}
