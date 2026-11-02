import { isClientCompany } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  companies,
  clientPortalAccess,
  contacts,
  memberships,
} from '@pts/db/schema'
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
 * When set, the portal is scoped to every client that contact has portal
 * access to (`client_portal_access`). Takes precedence over VIEW_AS_COOKIE.
 */
export const VIEW_AS_CONTACT_COOKIE = 'pts_view_as_contact'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PortalClientOption = {
  id: string
  name: string
}

export type PortalContactOption = {
  id: string
  name: string
  email: string | null
  /** True when the contact has a portal user account (userId IS NOT NULL). */
  isPromoted: boolean
}

export type PortalScope = {
  /** Clients whose data this request may touch. Empty means show nothing. */
  companyIds: string[]
  /** The same clients, with names, for display in the header. */
  scopedClients: PortalClientOption[]
  /** True when an admin has a valid contact selected. */
  isAdminPreview: boolean
  viewingAsClientId: string | null
  /** The contact the admin is currently previewing as (null if none selected). */
  viewingAsContactId: string | null
}

const EMPTY_ADMIN_SCOPE: PortalScope = {
  companyIds: [],
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

    // The view only lists live clients and live contacts.
    const accessible = await db
      .select({ id: companies.id, name: clientNameSql })
      .from(clientPortalAccess)
      .innerJoin(companies, eq(companies.id, clientPortalAccess.companyId))
      .where(eq(clientPortalAccess.userId, user.id))
      .orderBy(asc(clientNameSql))

    return {
      companyIds: accessible.map(m => m.id),
      scopedClients: accessible,
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

    return (
      db
        .select({
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          // mapWith(Boolean): isNotNull is SQL<unknown>, and the postgres driver
          // hands the flag back as a real boolean.
          isPromoted: isNotNull(contacts.userId).mapWith(Boolean),
        })
        .from(contacts)
        // Everyone at a current client, with or without portal access (as
        // before): previewing shows what they'd see once given access.
        // People at no client would preview an empty portal, so they're left
        // out.
        .where(
          and(
            isNull(contacts.deletedAt),
            inArray(
              contacts.id,
              db
                .selectDistinct({ id: memberships.contactId })
                .from(memberships)
                .innerJoin(
                  companies,
                  and(
                    eq(companies.id, memberships.companyId),
                    isNull(companies.deletedAt),
                    isClientCompany()
                  )
                )
                .where(isNull(memberships.endedAt))
            )
          )
        )
        .orderBy(asc(contacts.name))
    )
  }
)

async function resolveAdminScope(): Promise<PortalScope> {
  const cookieStore = await cookies()
  const selectedContactId =
    cookieStore.get(VIEW_AS_CONTACT_COOKIE)?.value ?? null

  // Fail closed: an admin with no selection sees an empty portal.
  if (!selectedContactId || !UUID_RE.test(selectedContactId)) {
    return EMPTY_ADMIN_SCOPE
  }

  // One round trip resolves both questions: does the contact still exist, and
  // which live clients is it linked to? Zero rows means the contact is gone
  // (fail closed); rows with a null client mean a valid contact with nothing
  // linked yet, which is still a valid preview.
  const rows = await db
    .select({ companyId: companies.id, clientName: clientNameSql })
    .from(contacts)
    // Every current client the person is at, portal access or not: the
    // admin sees what they'd see with access everywhere.
    // Current memberships only, at companies that are clients now.
    .leftJoin(
      memberships,
      and(eq(memberships.contactId, contacts.id), isNull(memberships.endedAt))
    )
    .leftJoin(
      companies,
      and(
        eq(companies.id, memberships.companyId),
        isNull(companies.deletedAt),
        isClientCompany()
      )
    )
    .where(and(eq(contacts.id, selectedContactId), isNull(contacts.deletedAt)))
    .orderBy(asc(clientNameSql))

  if (rows.length === 0) {
    return EMPTY_ADMIN_SCOPE
  }

  const linkedClients: PortalClientOption[] = []
  for (const row of rows) {
    if (row.companyId && row.clientName) {
      linkedClients.push({ id: row.companyId, name: row.clientName })
    }
  }

  return {
    companyIds: linkedClients.map(c => c.id),
    scopedClients: linkedClients,
    isAdminPreview: true,
    viewingAsClientId: null,
    viewingAsContactId: selectedContactId,
  }
}
