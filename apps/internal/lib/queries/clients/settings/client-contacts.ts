import 'server-only'

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, contacts, memberships, users } from '@/lib/db/schema'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
import {
  isMemberSql,
  mainCompanyIdSql,
  primaryContactIdSql,
  setPortalAccess,
} from '@/lib/queries/memberships'

const signInDisabledSql = sql<boolean>`exists (
  select 1 from users u
  where u.id = "contacts"."user_id"
    and (u.disabled_at is not null or u.deleted_at is not null)
)`

type ContactOption = {
  id: string
  companyId?: string | null
  name: string | null
  email: string | null
  phone: string | null
  hasPortalAccess: boolean
  /** Their login is switched off (or archived) on the Users page: no access anywhere. */
  signInDisabled?: boolean
  /** Their company's primary contact. */
  isPrimary?: boolean
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
 * Every live contact, for the client sheet's pickers (origination, closers)
 * and Portal access list. `companyId` is the client's company when they are
 * a member of it (so the Portal access list can pick them out), otherwise
 * their main company; `isPrimary` is the client's company's primary.
 */
async function listAllActiveContacts(
  user: AppUser,
  /** The client's company: its people are listed first. */
  companyId?: string | null
): Promise<ContactOption[]> {
  assertAdmin(user)

  const atClientCompany = companyId
    ? isMemberSql(contacts.id, sql`${companyId}::uuid`)
    : sql<boolean>`false`
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      userId: contacts.userId,
      signInDisabled: signInDisabledSql,
      atClientCompany,
      mainCompanyId: mainCompanyIdSql(contacts.id),
      isPrimary: companyId
        ? sql<boolean>`${contacts.id} = ${primaryContactIdSql(sql`${companyId}::uuid`)}`
        : sql<boolean>`false`,
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(desc(atClientCompany), asc(contacts.name), asc(contacts.email))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    hasPortalAccess: Boolean(row.userId),
    signInDisabled: row.signInDisabled,
    companyId: row.atClientCompany ? (companyId ?? null) : row.mainCompanyId,
    isPrimary: Boolean(row.isPrimary),
  }))
}

/** The client's company members who have portal access. */
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
      signInDisabled: signInDisabledSql,
      companyId: memberships.companyId,
      isPrimary: memberships.isPrimary,
    })
    .from(clients)
    .innerJoin(memberships, eq(memberships.companyId, clients.companyId))
    .innerJoin(contacts, eq(contacts.id, memberships.contactId))
    .where(
      and(
        eq(clients.id, clientId),
        isNull(memberships.endedAt),
        eq(memberships.portalAccess, true),
        // Access needs a login (same rule as client_portal_access).
        isNotNull(contacts.userId),
        isNull(contacts.deletedAt)
      )
    )
    .orderBy(asc(contacts.name), asc(contacts.email))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    hasPortalAccess: Boolean(row.userId),
    signInDisabled: row.signInDisabled,
    companyId: row.companyId,
    isPrimary: row.isPrimary,
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

  const [client] = clientId
    ? await db
        .select({ companyId: clients.companyId })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1)
    : []
  const [allContacts, linkedContacts, allAdminUsers] = await Promise.all([
    listAllActiveContacts(user, client?.companyId),
    clientId ? listClientContacts(user, clientId) : Promise.resolve([]),
    listAllAdminUsers(user),
  ])

  return { allContacts, linkedContacts, allAdminUsers }
}

/**
 * Saves the client sheet's Portal access switches: which of the company's
 * people can see this client in the client portal (those with a portal
 * login see it right away). Being at the company grants nothing by itself.
 * Access is a flag on each person's membership, so only members can have
 * it. The primary contact is the company's, set on the company sheet.
 */
export async function syncClientContacts(
  user: AppUser,
  clientId: string,
  contactIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  assertAdmin(user)

  const [client] = await db
    .select({ companyId: clients.companyId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)
  const companyId = client?.companyId ?? null
  if (!companyId) {
    return contactIds.length
      ? {
          ok: false,
          error:
            'Link this client to a company before giving its contacts portal access.',
        }
      : { ok: true }
  }

  const members = await db
    .select({
      contactId: memberships.contactId,
      name: contacts.name,
      userId: contacts.userId,
      portalAccess: memberships.portalAccess,
    })
    .from(memberships)
    .innerJoin(contacts, eq(contacts.id, memberships.contactId))
    .where(
      and(eq(memberships.companyId, companyId), isNull(memberships.endedAt))
    )
  const memberIds = new Set(members.map(member => member.contactId))
  const wanted = new Set(contactIds)

  const outsiderIds = contactIds.filter(id => !memberIds.has(id))
  if (outsiderIds.length) {
    const outsiders = await db
      .select({ name: contacts.name })
      .from(contacts)
      .where(inArray(contacts.id, outsiderIds))
    return {
      ok: false,
      error: `${outsiders.map(c => c.name).join(', ')} ${
        outsiders.length === 1 ? 'isn’t' : 'aren’t'
      } at this client’s company. Add them to the company first.`,
    }
  }

  const toGrant = members.filter(
    m => wanted.has(m.contactId) && !m.portalAccess
  )
  // Access needs a portal login; give one from the contact first.
  const withoutLogin = toGrant.filter(m => !m.userId)
  if (withoutLogin.length) {
    return {
      ok: false,
      error: `${withoutLogin.map(m => m.name).join(', ')} ${
        withoutLogin.length === 1 ? 'has' : 'have'
      } no portal user yet. Create one from their contact first.`,
    }
  }
  const toRevoke = members.filter(
    m => !wanted.has(m.contactId) && m.portalAccess
  )
  const changes: ContactClientLinkChange[] = [
    ...toGrant.map(m => ({
      contactId: m.contactId,
      clientId,
      action: 'linked' as const,
    })),
    ...toRevoke.map(m => ({
      contactId: m.contactId,
      clientId,
      action: 'unlinked' as const,
    })),
  ]
  if (!changes.length) return { ok: true }

  try {
    await db.transaction(async tx => {
      for (const member of toGrant) {
        await setPortalAccess(tx, member.contactId, companyId, true)
      }
      for (const member of toRevoke) {
        await setPortalAccess(tx, member.contactId, companyId, false)
      }
    })
  } catch (error) {
    console.error('Failed to update portal access', error)
    return { ok: false, error: 'Failed to update portal access.' }
  }

  // Committed; a logging failure must not report the save as failed.
  await logContactClientLinkChanges(user, changes)

  return { ok: true }
}
