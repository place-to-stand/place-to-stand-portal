import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientMembers, clients } from '@pts/db/schema'
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

export type PortalClientOption = {
  id: string
  name: string
}

export type PortalScope = {
  /** Clients whose data this request may touch. Empty means show nothing. */
  clientIds: string[]
  /** The same clients, with names, for display in the header. */
  scopedClients: PortalClientOption[]
  /** True when an admin has a valid client selected. */
  isAdminPreview: boolean
  viewingAsClientId: string | null
  /** Clients the admin may switch between. Always empty for non-admins. */
  availableClients: PortalClientOption[]
}

const EMPTY_ADMIN_SCOPE: Omit<PortalScope, 'availableClients'> = {
  clientIds: [],
  scopedClients: [],
  isAdminPreview: false,
  viewingAsClientId: null,
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
    }
  }
)

async function resolveAdminScope(): Promise<PortalScope> {
  const availableClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(asc(clients.name))

  const cookieStore = await cookies()
  const selectedClientId = cookieStore.get(VIEW_AS_COOKIE)?.value ?? null

  // Re-validate the selection against live rows on every request so a client
  // that has since been archived falls back to "nothing selected".
  const isValidSelection =
    !!selectedClientId &&
    availableClients.some(client => client.id === selectedClientId)

  if (!isValidSelection) {
    // Fail closed: an admin with no valid selection sees an empty portal
    // rather than every client's data at once.
    return { ...EMPTY_ADMIN_SCOPE, availableClients }
  }

  const selected = availableClients.filter(c => c.id === selectedClientId)

  return {
    clientIds: [selectedClientId],
    scopedClients: selected,
    isAdminPreview: true,
    viewingAsClientId: selectedClientId,
    availableClients,
  }
}
