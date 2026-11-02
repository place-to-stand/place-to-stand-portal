import { isClientCompany } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import 'server-only'

import { asc, desc, eq, and, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { companies, clientPortalAccess, contacts } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import {
  canSeePortalAccess,
  withoutPortalAccess,
} from '@/lib/settings/contacts/portal-visibility'

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
  /** Their photo's path (contacts.avatar_url). */
  avatarUrl: string | null
  /**
   * Their saved details as of this read, with the row's `updated_at`: the
   * version the sheet sends back on Save, so a save made meanwhile by
   * someone else is refused instead of overwritten. Null if not found.
   */
  person: {
    name: string
    email: string | null
    phone: string | null
    linkedinUrl: string | null
    updatedAt: string
    /** Their sign-in's role while they can sign in (null: they can't). */
    signInRole: 'ADMIN' | 'SALES' | 'CLIENT' | null
  } | null
}

/** Fetches all active clients (contacts client filter, MCP directory). */
export async function listAllActiveClients(
  user: AppUser
): Promise<ClientOption[]> {
  assertCrmAccess(user)

  const rows = await db
    .select({
      id: companies.id,
      name: clientNameSql,
      slug: companies.slug,
      companyId: companies.id,
    })
    .from(companies)
    .where(isClientCompany())
    .orderBy(asc(clientNameSql))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug ?? row.id,
  }))
}

/**
 * Every live company for the People company filter: clients first, then the
 * rest, each by name.
 */
export async function listCompanyFilterOptions(
  user: AppUser
): Promise<ClientOption[]> {
  assertCrmAccess(user)

  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
    })
    .from(companies)
    .where(isNull(companies.deletedAt))
    .orderBy(desc(isClientCompany()), asc(companies.name))

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
      id: companies.id,
      name: clientNameSql,
      slug: companies.slug,
      companyId: companies.id,
    })
    .from(clientPortalAccess)
    .innerJoin(companies, eq(clientPortalAccess.companyId, companies.id))
    .where(and(eq(clientPortalAccess.contactId, contactId), isClientCompany()))
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

  const [byContact, [person]] = await Promise.all([
    listContactMemberships([contactId], undefined, { includeArchived: true }),
    db
      .select({
        avatarUrl: contacts.avatarUrl,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        linkedinUrl: contacts.linkedinUrl,
        updatedAt: contacts.updatedAt,
        // A role only while it is live (stripped for Sales below).
        signInRole: sql<'ADMIN' | 'SALES' | 'CLIENT' | null>`(
          select u.role from users u
          where u.id = ${contacts.userId}
            and u.deleted_at is null and u.disabled_at is null
        )`,
      })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1),
  ])
  const memberships = byContact.get(contactId) ?? []
  return {
    // Portal access is for people who manage clients only.
    memberships: canSeePortalAccess(user.role)
      ? memberships
      : memberships.map(withoutPortalAccess),
    avatarUrl: person?.avatarUrl ?? null,
    person: person
      ? {
          name: person.name,
          email: person.email,
          phone: person.phone,
          linkedinUrl: person.linkedinUrl,
          updatedAt: person.updatedAt,
          // Sign-ins are admin-only information, as on the people list.
          signInRole: canSeePortalAccess(user.role)
            ? (person.signInRole ?? null)
            : null,
        }
      : null,
  }
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
