import 'server-only'

import {
  and,
  asc,
  eq,
  getTableName,
  inArray,
  isNull,
  sql,
  type SQL,
} from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import { db } from '@/lib/db'
import { companies, contacts, memberships } from '@/lib/db/schema'
import { isClientCompany } from '@pts/db/client-state'

/**
 * Memberships: a person at a company, with their title there, whether they
 * are its primary contact and whether they can see its client in the client
 * portal. A person can belong to several companies; the oldest current
 * membership is their main company (list columns, pickers). Every read and
 * write of those facts goes through here.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

const now = sql`timezone('utc'::text, now())`

/** Current memberships only. */
export const isCurrentMembership = isNull(memberships.endedAt)

// Correlated subqueries for selects keyed on a contact or company column.
// Raw SQL on purpose: they reference the outer row's column, written out
// table-qualified (drizzle drops the table name from an interpolated column
// inside a selected fragment, which would bind it to the subquery's table).
const ref = (value: AnyPgColumn | SQL): SQL =>
  'table' in value && 'name' in value
    ? sql.raw(`"${getTableName(value.table)}"."${value.name}"`)
    : (value as SQL)

/**
 * True when the company (aliased `co`) is active: not archived, and not a
 * former client (billing stopped). Memberships at inactive companies stay in
 * the database as history but are hidden from active views (lists, counts,
 * main company, CLI/MCP).
 */
const activeCompanyCondition = (co: string) =>
  `${co}.deleted_at is null and (company_billing_open(${co}.id) or not company_was_client(${co}.id))`

/** SQL predicate for an active company, by table alias. */
export const activeCompanySql = (alias: string) =>
  sql.raw(`(${activeCompanyCondition(alias)})`)

/** The contact's main company id (oldest current membership at an active company). */
export const mainCompanyIdSql = (contactId: AnyPgColumn | SQL) =>
  sql<string | null>`(
    select m.company_id from memberships m
    join companies co on co.id = m.company_id and ${activeCompanySql('co')}
    where m.contact_id = ${ref(contactId)} and m.ended_at is null
    order by m.started_at, m.created_at, m.company_id limit 1
  )`

/** The contact's main company name. */
export const mainCompanyNameSql = (contactId: AnyPgColumn | SQL) =>
  sql<string | null>`(
    select co.name from memberships m
    join companies co on co.id = m.company_id and ${activeCompanySql('co')}
    where m.contact_id = ${ref(contactId)} and m.ended_at is null
    order by m.started_at, m.created_at, m.company_id limit 1
  )`

/** The contact's title at their main company. */
export const mainTitleSql = (contactId: AnyPgColumn | SQL) =>
  sql<string | null>`(
    select m.title from memberships m
    join companies co on co.id = m.company_id and ${activeCompanySql('co')}
    where m.contact_id = ${ref(contactId)} and m.ended_at is null
    order by m.started_at, m.created_at, m.company_id limit 1
  )`

/** The company's primary contact id. */
export const primaryContactIdSql = (companyId: AnyPgColumn | SQL) =>
  sql<string | null>`(
    select m.contact_id from memberships m
    where m.company_id = ${ref(companyId)} and m.is_primary and m.ended_at is null
    limit 1
  )`

/** The company's primary contact name (live contacts only). */
export const primaryContactNameSql = (companyId: AnyPgColumn | SQL) =>
  sql<string | null>`(
    select ct.name from memberships m
    join contacts ct on ct.id = m.contact_id and ct.deleted_at is null
    where m.company_id = ${ref(companyId)} and m.is_primary and m.ended_at is null
    limit 1
  )`

/** True when the contact is a current member of the company. */
export const isMemberSql = (
  contactId: AnyPgColumn | SQL,
  companyId: AnyPgColumn | SQL
) =>
  sql<boolean>`exists (
    select 1 from memberships m
    where m.contact_id = ${ref(contactId)} and m.company_id = ${ref(companyId)}
      and m.ended_at is null
  )`

export type ContactMembership = {
  companyId: string
  companyName: string
  title: string | null
  isPrimary: boolean
  /** The switch as stored (what the contact sheet edits). */
  portalAccess: boolean
  /** Real access: a row in client_portal_access (switch on, a login, live client). */
  hasPortalAccess: boolean
  /** The company's live client, if it has one. */
  clientCompanyId: string | null
  clientName: string | null
  startedAt: string
  /** The company is archived, or its client is (history; hidden in active views). */
  archived: boolean
}

/**
 * A contact's current companies, main company first. Archived companies
 * (or ones whose client is archived) are left out unless `includeArchived`
 * (the contact sheet shows them muted, and saves the full set).
 */
export async function listContactMemberships(
  contactIds: readonly string[],
  executor: Executor = db,
  { includeArchived = false }: { includeArchived?: boolean } = {}
): Promise<Map<string, ContactMembership[]>> {
  const byContact = new Map<string, ContactMembership[]>()
  if (contactIds.length === 0) return byContact

  const rows = await executor
    .select({
      contactId: memberships.contactId,
      companyId: memberships.companyId,
      companyName: companies.name,
      title: memberships.title,
      isPrimary: memberships.isPrimary,
      portalAccess: memberships.portalAccess,
      // A company billed now is a client: its id is the client's.
      clientCompanyId: sql<
        string | null
      >`case when ${isClientCompany()} then ${companies.id} end`,
      clientName: sql<
        string | null
      >`case when ${isClientCompany()} then ${companies.name} end`,
      startedAt: memberships.startedAt,
      archived: sql<boolean>`not ${activeCompanySql('companies')}`,
      hasPortalAccess: sql<boolean>`exists (
        select 1 from client_portal_access a
        where a.contact_id = "memberships"."contact_id"
          and a.company_id = "memberships"."company_id"
      )`,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(
      and(
        isCurrentMembership,
        inArray(memberships.contactId, [...contactIds]),
        includeArchived ? undefined : activeCompanySql('companies')
      )
    )
    .orderBy(
      asc(memberships.startedAt),
      asc(memberships.createdAt),
      asc(memberships.companyId)
    )

  for (const row of rows) {
    const list = byContact.get(row.contactId) ?? []
    list.push({
      companyId: row.companyId,
      companyName: row.companyName,
      title: row.title,
      isPrimary: row.isPrimary,
      portalAccess: row.portalAccess,
      clientCompanyId: row.clientCompanyId ?? null,
      clientName: row.clientName ?? null,
      startedAt: row.startedAt,
      archived: row.archived,
      hasPortalAccess: row.hasPortalAccess,
    })
    byContact.set(row.contactId, list)
  }
  return byContact
}

export type CompanyMember = {
  contactId: string
  name: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  userId: string | null
  title: string | null
  isPrimary: boolean
  portalAccess: boolean
}

/** A company's current people (live contacts), by name. */
export async function listCompanyMembers(
  companyId: string,
  executor: Executor = db
): Promise<CompanyMember[]> {
  return executor
    .select({
      contactId: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      linkedinUrl: contacts.linkedinUrl,
      userId: contacts.userId,
      title: memberships.title,
      isPrimary: memberships.isPrimary,
      portalAccess: memberships.portalAccess,
    })
    .from(memberships)
    .innerJoin(contacts, eq(contacts.id, memberships.contactId))
    .where(
      and(
        isCurrentMembership,
        eq(memberships.companyId, companyId),
        isNull(contacts.deletedAt)
      )
    )
    .orderBy(asc(sql`lower(${contacts.name})`))
}

/**
 * Adds the contact to the company (no-op if they're already a current
 * member). Returns true when a membership was created.
 */
export async function joinCompany(
  executor: Executor,
  contactId: string,
  companyId: string,
  options: { title?: string | null; portalAccess?: boolean } = {}
): Promise<boolean> {
  const inserted = await executor
    .insert(memberships)
    .values({
      contactId,
      companyId,
      title: options.title?.trim() || null,
      portalAccess: options.portalAccess ?? false,
    })
    .onConflictDoNothing({
      target: [memberships.contactId, memberships.companyId],
      where: sql`ended_at IS NULL`,
    })
    .returning({ id: memberships.id })
  return inserted.length > 0
}

/**
 * Ends the contact's membership at the company: they stop being its
 * primary contact and lose portal access to its client. History is kept.
 * Returns true when a current membership was ended.
 */
export async function leaveCompany(
  executor: Executor,
  contactId: string,
  companyId: string
): Promise<boolean> {
  const ended = await executor
    .update(memberships)
    .set({
      endedAt: now,
      isPrimary: false,
      portalAccess: false,
      updatedAt: now,
    })
    .where(
      and(
        isCurrentMembership,
        eq(memberships.contactId, contactId),
        eq(memberships.companyId, companyId)
      )
    )
    .returning({ id: memberships.id })
  return ended.length > 0
}

/** Sets the contact's title at a company they're a member of. */
export async function setMembershipTitle(
  executor: Executor,
  contactId: string,
  companyId: string,
  title: string | null
) {
  await executor
    .update(memberships)
    .set({ title: title?.trim() || null, updatedAt: now })
    .where(
      and(
        isCurrentMembership,
        eq(memberships.contactId, contactId),
        eq(memberships.companyId, companyId)
      )
    )
}

/**
 * Makes the contact the company's primary contact (or, with null, clears
 * it). The contact must be a current member. Returns false if they aren't.
 */
export async function setCompanyPrimary(
  executor: Executor,
  companyId: string,
  contactId: string | null
): Promise<boolean> {
  // Clearing the old primary and setting the new one commit together.
  if (executor === db) {
    return db.transaction(tx => setCompanyPrimary(tx, companyId, contactId))
  }
  // Check the new primary is a member before touching the current one, so a
  // refused change leaves the company's primary as it was.
  if (contactId) {
    const [member] = await executor
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          isCurrentMembership,
          eq(memberships.companyId, companyId),
          eq(memberships.contactId, contactId)
        )
      )
      .limit(1)
    if (!member) return false
  }
  await executor
    .update(memberships)
    .set({ isPrimary: false, updatedAt: now })
    .where(
      and(
        isCurrentMembership,
        eq(memberships.companyId, companyId),
        eq(memberships.isPrimary, true)
      )
    )
  if (!contactId) return true
  const updated = await executor
    .update(memberships)
    .set({ isPrimary: true, updatedAt: now })
    .where(
      and(
        isCurrentMembership,
        eq(memberships.companyId, companyId),
        eq(memberships.contactId, contactId)
      )
    )
    .returning({ id: memberships.id })
  return updated.length > 0
}

/**
 * Switches a member's portal access to the company's client. Access needs a
 * portal login, so switching it on for a contact without one (or who isn't
 * a current member) does nothing and returns false. Give them a login first
 * (the contact sheet's Create account).
 */
export async function setPortalAccess(
  executor: Executor,
  contactId: string,
  companyId: string,
  portalAccess: boolean
): Promise<boolean> {
  if (portalAccess && !(await hasPortalLogin(executor, contactId))) {
    return false
  }
  const updated = await executor
    .update(memberships)
    .set({ portalAccess, updatedAt: now })
    .where(
      and(
        isCurrentMembership,
        eq(memberships.contactId, contactId),
        eq(memberships.companyId, companyId)
      )
    )
    .returning({ id: memberships.id })
  return updated.length > 0
}

/** The contact has a portal login (`contacts.user_id`). */
export async function hasPortalLogin(
  executor: Executor,
  contactId: string
): Promise<boolean> {
  const [row] = await executor
    .select({ userId: contacts.userId })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1)
  return Boolean(row?.userId)
}
