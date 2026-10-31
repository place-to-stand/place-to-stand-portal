import { wasClientCompany } from '@pts/db/client-state'
import { personAvatarSql, personNameSql } from '@pts/db/names'
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
import { db, type DbTx } from '@/lib/db'
import { companies, contacts, memberships, users } from '@/lib/db/schema'
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
  /** Their login is switched off (or archived) on their person sheet: no access anywhere. */
  signInDisabled?: boolean
  /** Their company's primary contact. */
  isPrimary?: boolean
  /** They have a photo; the pickers show it, else initials. */
  hasPhoto?: boolean
}

type AdminUserOption = {
  id: string
  fullName: string | null
  email: string
  disabledAt: string | null
  /** Their person has a photo; the pickers show it, else initials. */
  hasPhoto: boolean
}

export type ClientSheetContactData = {
  allContacts: ContactOption[]
  linkedContacts: ContactOption[]
  allAdminUsers: AdminUserOption[]
}

/**
 * Every live contact, for the billing section's pickers (origination, closers)
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
      hasPhoto: sql<boolean>`${contacts.avatarUrl} is not null`,
      atClientCompany,
      mainCompanyId: mainCompanyIdSql(contacts.id),
      isPrimary: companyId
        ? sql<boolean>`${contacts.id} = ${primaryContactIdSql(sql`${companyId}::uuid`)}`
        : sql<boolean>`false`,
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    // Postgres rejects ORDER BY a constant: only lead with the company's
    // people when there is a company.
    .orderBy(
      ...(companyId ? [desc(atClientCompany)] : []),
      asc(contacts.name),
      asc(contacts.email)
    )

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    hasPortalAccess: Boolean(row.userId),
    signInDisabled: row.signInDisabled,
    companyId: row.atClientCompany ? (companyId ?? null) : row.mainCompanyId,
    isPrimary: Boolean(row.isPrimary),
    hasPhoto: row.hasPhoto,
  }))
}

/** The client's company members who have portal access. */
async function listClientContacts(
  user: AppUser,
  clientCompanyId: string
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
    .from(companies)
    .innerJoin(memberships, eq(memberships.companyId, companies.id))
    .innerJoin(contacts, eq(contacts.id, memberships.contactId))
    .where(
      and(
        wasClientCompany(),
        and(
          eq(companies.id, clientCompanyId),
          isNull(memberships.endedAt),
          eq(memberships.portalAccess, true),
          // Access needs a login (same rule as client_portal_access).
          isNotNull(contacts.userId),
          isNull(contacts.deletedAt)
        )
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
 * Fetches all staff users (ADMIN and SALES) for the origination and closer
 * pickers, so a salesperson can take credit for a client they brought in.
 */
async function listAllAdminUsers(user: AppUser): Promise<AdminUserOption[]> {
  assertAdmin(user)

  const rows = await db
    .select({
      id: users.id,
      fullName: personNameSql,
      email: users.email,
      disabledAt: users.disabledAt,
      avatarUrl: personAvatarSql,
    })
    .from(users)
    .where(
      and(inArray(users.role, ['ADMIN', 'SALES']), isNull(users.deletedAt))
    )
    .orderBy(asc(personNameSql), asc(users.email))

  return rows.map(row => ({
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    disabledAt: row.disabledAt,
    hasPhoto: Boolean(row.avatarUrl),
  }))
}

/**
 * Fetches all data needed for the billing section's contact and partner pickers.
 * If clientCompanyId is provided, also fetches the client's linked contacts.
 */
export async function getClientSheetContactData(
  user: AppUser,
  clientCompanyId?: string
): Promise<ClientSheetContactData> {
  assertAdmin(user)

  const [client] = clientCompanyId
    ? await db
        .select({ companyId: companies.id })
        .from(companies)
        .where(and(wasClientCompany(), eq(companies.id, clientCompanyId)))
        .limit(1)
    : []
  const [allContacts, linkedContacts, allAdminUsers] = await Promise.all([
    listAllActiveContacts(user, client?.companyId),
    clientCompanyId
      ? listClientContacts(user, clientCompanyId)
      : Promise.resolve([]),
    listAllAdminUsers(user),
  ])

  return { allContacts, linkedContacts, allAdminUsers }
}

/** A person who can't be given portal access (no sign-in, or not a member). */
export class PortalAccessRefusal extends Error {}

/**
 * Switches portal access on and off for members of a client company inside
 * the caller's transaction. Granting needs a sign-in (`contacts.user_id`) and
 * a current membership; a person without either throws
 * `PortalAccessRefusal`, rolling the save back.
 */
export async function applyPortalAccessInTx(
  tx: DbTx,
  actor: AppUser,
  companyId: string,
  changes: { grant: string[]; revoke: string[] }
): Promise<void> {
  for (const contactId of changes.grant) {
    if (!(await setPortalAccess(tx, actor, contactId, companyId, true))) {
      throw new PortalAccessRefusal(
        'Someone given portal access has no sign-in or left this company. Reload and try again.'
      )
    }
  }
  for (const contactId of changes.revoke) {
    await setPortalAccess(tx, actor, contactId, companyId, false)
  }
}
