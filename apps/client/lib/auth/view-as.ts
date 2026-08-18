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
  /** @deprecated Use availableContacts / viewingAsContactId instead. */
  availableClients: PortalClientOption[]
  /** Contacts the admin may switch between. Always empty for non-admins. */
  availableContacts: PortalContactOption[]
  /** The contact the admin is currently previewing as (null if none selected). */
  viewingAsContactId: string | null
}

const EMPTY_ADMIN_SCOPE: Omit<PortalScope, 'availableClients' | 'availableContacts'> = {
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
      availableClients: [],
      availableContacts: [],
      viewingAsContactId: null,
    }
  }
)

async function resolveAdminScope(): Promise<PortalScope> {
  // Fetch all non-deleted contacts ordered by name, with promoted flag.
  const availableContacts = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      isPromoted: isNotNull(contacts.userId),
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(asc(contacts.name))

  const cookieStore = await cookies()
  const selectedContactId = cookieStore.get(VIEW_AS_CONTACT_COOKIE)?.value ?? null

  // Re-validate the selection against live rows on every request so a contact
  // that has since been deleted falls back to "nothing selected".
  const isValidContactSelection =
    !!selectedContactId &&
    availableContacts.some(c => c.id === selectedContactId)

  if (!isValidContactSelection) {
    // Fail closed: an admin with no valid selection sees an empty portal.
    return {
      ...EMPTY_ADMIN_SCOPE,
      availableClients: [],
      availableContacts,
    }
  }

  // Derive clientIds from contact_clients join.
  const linkedClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(contactClients)
    .innerJoin(clients, eq(clients.id, contactClients.clientId))
    .where(
      and(
        eq(contactClients.contactId, selectedContactId),
        isNull(clients.deletedAt)
      )
    )
    .orderBy(asc(clients.name))

  return {
    clientIds: linkedClients.map(c => c.id),
    scopedClients: linkedClients,
    isAdminPreview: true,
    viewingAsClientId: null,
    availableClients: [],
    availableContacts,
    viewingAsContactId: selectedContactId,
  }
}
