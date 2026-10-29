import 'server-only'

import { asc, eq, and, inArray, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clients,
  contacts,
  contactClients,
  users,
} from '@/lib/db/schema'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { syncPortalMembershipsForLinkChanges } from '@/lib/queries/contacts/settings/contact-client-portal-memberships'
import {
  isClientPrimaryContactSql,
  setClientPrimaryContact,
} from '@/lib/queries/clients/primary-contact'
import { ForbiddenError } from '@/lib/errors/http'
import { syncCompanyClientLinksTx } from '@/lib/queries/companies/people-links'

type ContactOption = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  hasPortalAccess: boolean
  /** Set on linked contacts only: the client's primary contact. */
  isPrimary?: boolean
  /** Set on linked contacts only: works at the client's company. */
  atCompany?: boolean
}

type AdminUserOption = {
  id: string
  fullName: string | null
  email: string
  disabledAt: string | null
}

export type ClientSheetContactData = {
  allContacts: ContactOption[]
  linkedContacts: ContactOption[]
  allAdminUsers: AdminUserOption[]
}

/**
 * Fetches all active contacts for use in the client sheet contact picker.
 */
async function listAllActiveContacts(user: AppUser): Promise<ContactOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      userId: contacts.userId,
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(asc(contacts.name), asc(contacts.email))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    hasPortalAccess: Boolean(row.userId),
  }))
}

/**
 * Fetches the contacts linked to a specific client.
 */
async function listClientContacts(
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
      userId: contacts.userId,
      isPrimary: isClientPrimaryContactSql,
      atCompany: sql<boolean>`${contacts.companyId} is not distinct from ${clients.companyId} and ${clients.companyId} is not null`,
    })
    .from(contactClients)
    .innerJoin(contacts, eq(contactClients.contactId, contacts.id))
    .innerJoin(clients, eq(clients.id, contactClients.clientId))
    .where(
      and(eq(contactClients.clientId, clientId), isNull(contacts.deletedAt))
    )
    .orderBy(asc(contacts.name), asc(contacts.email))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    hasPortalAccess: Boolean(row.userId),
    isPrimary: row.isPrimary,
    atCompany: Boolean(row.atCompany),
  }))
}

/**
 * Fetches all active ADMIN users for use in origination + closer pickers.
 */
async function listAllAdminUsers(user: AppUser): Promise<AdminUserOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(and(eq(users.role, 'ADMIN'), isNull(users.deletedAt)))
    .orderBy(asc(users.fullName), asc(users.email))

  return rows.map(row => ({
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    disabledAt: row.disabledAt,
  }))
}

/**
 * Fetches all data needed for the client sheet contact and partner pickers.
 * If clientId is provided, also fetches the client's linked contacts.
 */
export async function getClientSheetContactData(
  user: AppUser,
  clientId?: string
): Promise<ClientSheetContactData> {
  assertAdmin(user)

  const [allContacts, linkedContacts, allAdminUsers] = await Promise.all([
    listAllActiveContacts(user),
    clientId ? listClientContacts(user, clientId) : Promise.resolve([]),
    listAllAdminUsers(user),
  ])

  return { allContacts, linkedContacts, allAdminUsers }
}

/**
 * Saves the client sheet's contact list. A client's people are its
 * company's people, so this only adds: someone added joins the company
 * (refused when they work elsewhere) and so gets every one of its clients.
 * Unlinking here only drops an old hand-made link to someone at another
 * company; people leave a company from the company or the contact.
 * Everything below commits together, portal access included; the primary
 * star is set last, once the links it depends on exist.
 */
export async function syncClientContacts(
  user: AppUser,
  clientId: string,
  contactIds: string[],
  /** Must be one of `contactIds`; anything else clears the primary. */
  primaryContactId: string | null
): Promise<{ ok: boolean; error?: string }> {
  assertAdmin(user)

  const [client] = await db
    .select({ companyId: clients.companyId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)
  if (!client) return { ok: false, error: 'Client not found.' }
  const companyId = client.companyId

  const currentLinks = await db
    .select({
      contactId: contactClients.contactId,
      contactCompanyId: contacts.companyId,
    })
    .from(contactClients)
    .innerJoin(contacts, eq(contacts.id, contactClients.contactId))
    .where(eq(contactClients.clientId, clientId))
  const currentIds = new Set(currentLinks.map(link => link.contactId))
  const wanted = new Set(contactIds)
  const toAdd = contactIds.filter(id => !currentIds.has(id))
  // Company people stay linked whatever the sheet sent (it may not list
  // them yet, e.g. on create); only other-company links can be dropped.
  const toRemove = currentLinks
    .filter(
      link =>
        !wanted.has(link.contactId) &&
        (!companyId || link.contactCompanyId !== companyId)
    )
    .map(link => link.contactId)

  // Validate before writing anything.
  if (companyId && toAdd.length > 0) {
    const elsewhere = await db
      .select({ name: contacts.name })
      .from(contacts)
      .where(
        and(
          inArray(contacts.id, toAdd),
          sql`${contacts.companyId} is not null and ${contacts.companyId} <> ${companyId}`
        )
      )
    if (elsewhere.length > 0) {
      return {
        ok: false,
        error: `${elsewhere.map(c => c.name).join(', ')} ${
          elsewhere.length === 1 ? 'works' : 'work'
        } at another company. Change their company first.`,
      }
    }
  }

  let changes: ContactClientLinkChange[] = []
  try {
    await db.transaction(async tx => {
      if (toAdd.length > 0) {
        await tx
          .insert(contactClients)
          .values(toAdd.map(contactId => ({ contactId, clientId })))
          .onConflictDoNothing({
            target: [contactClients.contactId, contactClients.clientId],
          })
      }
      if (toRemove.length > 0) {
        await tx
          .delete(contactClients)
          .where(
            and(
              eq(contactClients.clientId, clientId),
              inArray(contactClients.contactId, toRemove)
            )
          )
      }
      changes = [
        ...toAdd.map(contactId => ({
          contactId,
          clientId,
          action: 'linked' as const,
        })),
        ...toRemove.map(contactId => ({
          contactId,
          clientId,
          action: 'unlinked' as const,
        })),
      ]
      await syncPortalMembershipsForLinkChanges(changes, tx)

      if (companyId && toAdd.length > 0) {
        // Joining the company links them to its other clients too.
        await tx
          .update(contacts)
          .set({ companyId, updatedAt: new Date().toISOString() })
          .where(and(inArray(contacts.id, toAdd), isNull(contacts.companyId)))
        changes = [
          ...changes,
          ...(await syncCompanyClientLinksTx(tx, [companyId])),
        ]
      }
    })
  } catch (error) {
    console.error('Failed to update client contacts', error)
    return { ok: false, error: 'Failed to update contact links.' }
  }

  // The primary contact lives on the client's company; set it now that the
  // links exist. Clearing considers the links before and after.
  const primaryId =
    primaryContactId && wanted.has(primaryContactId) ? primaryContactId : null
  try {
    await setClientPrimaryContact(clientId, primaryId, [
      ...new Set([...currentIds, ...contactIds]),
    ])
  } catch (error) {
    await logContactClientLinkChanges(user, changes)
    if (error instanceof ForbiddenError) {
      return { ok: false, error: error.message }
    }
    console.error('Failed to set the client primary contact', error)
    return {
      ok: false,
      error: 'Contacts saved, but the primary contact could not be set.',
    }
  }

  // The links are committed; a logging failure must not report the sync as failed.
  await logContactClientLinkChanges(user, changes)

  return { ok: true }
}
