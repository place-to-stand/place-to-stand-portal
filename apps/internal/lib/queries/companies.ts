import { personNameSql } from '@pts/db/names'
import 'server-only'

import {
  billingEndsOnSql,
  billingOpenSql,
  isClientCompany,
  isFormerClientSql,
  wasClientCompany,
} from '@pts/db/client-state'

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm'
import type { z } from 'zod'

import {
  companyArchivedEvent,
  companyPrimaryContactSetEvent,
  companyCreatedEvent,
  companyRestoredEvent,
  companyUpdatedEvent,
  contactUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import {
  isMemberSql,
  joinCompany,
  leaveCompany,
  listCompanyMembers,
  primaryContactIdSql,
  primaryContactNameSql,
  setCompanyPrimary,
  setMembershipTitle,
} from '@/lib/queries/memberships'
import { roleCan } from '@/lib/auth/capabilities'
import { isAdminRole } from '@/lib/auth/roles'
import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import type {
  CompanyActionResult,
  CompanyDetail,
  CompanyListItem,
  CompanyOption,
} from '@/lib/companies/types'
import {
  companyNameSchema,
  normalizeWebAddress,
  saveCompanySchema,
} from '@/lib/companies/schema'
import { db, uniqueViolation, type DbTx } from '@/lib/db'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { revokeCompanyPortalAccess } from '@/lib/companies/billing/revoke-company-portal-access'
import { ARCHIVE_BILLED_REFUSAL } from '@/lib/companies/archive-refusal'
import { companies, contacts, leads, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { LeadStatusValue } from '@/lib/leads/constants'

type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update'>

/** Queues work (an activity write) to run once the caller's transaction commits. */
export type DeferActivity = (task: () => Promise<unknown>) => void

const CLOSED_LEAD_STATUSES_SQL = sql`('CLOSED_WON', 'CLOSED_LOST', 'UNQUALIFIED')`

const DUPLICATE_NAME_ERROR = 'A company with this name already exists.'

/** A save's unique violation, in words that match the index it hit. */
function saveConflictMessage(constraint: string): string {
  switch (constraint) {
    case 'memberships_one_primary_per_company':
      return 'The primary contact just changed. Reload and try again.'
    case 'memberships_one_current_per_contact_company':
      return 'A person on this company just changed. Reload and try again.'
    case 'idx_companies_name_unique':
      return DUPLICATE_NAME_ERROR
    default:
      return 'Unable to save the company. Reload and try again.'
  }
}

/** Escape LIKE wildcards so a search for "50%" means the literal text. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

export async function listCompanies(
  user: AppUser,
  options: { status?: 'active' | 'archived'; search?: string | null } = {}
): Promise<CompanyListItem[]> {
  assertCrmAccess(user)

  const status = options.status ?? 'active'
  const search = options.search?.trim() ?? ''

  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      website: companies.website,
      isStaff: companies.isStaff,
      // Billed now: the company is its own client.
      isClient: sql<boolean | null>`${isClientCompany()}`,
      // Billed before but not now.
      formerClient: isFormerClientSql,
      updatedAt: companies.updatedAt,
      deletedAt: companies.deletedAt,
      people: sql<CompanyListItem['people']>`coalesce((
        select json_agg(
          json_build_object(
            'id', ct.id, 'name', ct.name, 'email', ct.email,
            'jobTitle', m.title, 'isPrimary', m.is_primary
          ) order by m.is_primary desc, lower(ct.name)
        )
        from memberships m
        join contacts ct on ct.id = m.contact_id and ct.deleted_at is null
        where m.company_id = companies.id and m.ended_at is null
      ), '[]'::json)`,
      openLeads: sql<CompanyListItem['openLeads']>`coalesce((
        select json_agg(
          json_build_object(
            'id', l.id, 'contactName', lc.name, 'status', l.status
          ) order by l.updated_at desc
        )
        from leads l
        join contacts lc on lc.id = l.contact_id
        where l.company_id = companies.id
          and l.deleted_at is null
          and l.status not in ${CLOSED_LEAD_STATUSES_SQL}
      ), '[]'::json)`,
      primaryContactName: primaryContactNameSql(companies.id),
    })
    .from(companies)
    .where(
      and(
        status === 'active'
          ? isNull(companies.deletedAt)
          : isNotNull(companies.deletedAt),
        search ? ilike(companies.name, `%${escapeLike(search)}%`) : undefined
      )
    )
    .orderBy(
      status === 'active'
        ? asc(sql`lower(${companies.name})`)
        : desc(companies.deletedAt)
    )

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    website: row.website,
    companyId: row.isClient ? row.id : null,
    clientName: row.isClient ? row.name : null,
    formerClient: Boolean(row.formerClient),
    people: row.people ?? [],
    openLeads: row.openLeads ?? [],
    contactCount: row.people?.length ?? 0,
    openLeadCount: row.openLeads?.length ?? 0,
    primaryContactName: row.primaryContactName ?? null,
    // Same rules as setCompanyArchived: staff sign in through this company,
    // and a billed company stops billing before it is archived.
    archiveRefusal:
      row.isStaff && !isAdminRole(user.role)
        ? `Only an admin can change ${row.name}.`
        : row.isClient && !row.deletedAt
          ? ARCHIVE_BILLED_REFUSAL
          : null,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  }))
}

export async function countCompanies(user: AppUser) {
  assertCrmAccess(user)
  const [active] = await db
    .select({ count: sql<number>`count(*)` })
    .from(companies)
    .where(isNull(companies.deletedAt))
  const [archived] = await db
    .select({ count: sql<number>`count(*)` })
    .from(companies)
    .where(isNotNull(companies.deletedAt))
  return {
    active: Number(active?.count ?? 0),
    archived: Number(archived?.count ?? 0),
  }
}

/** Archived companies included, so a link to one still opens. */
export async function getCompanyDetail(
  user: AppUser,
  companyId: string
): Promise<CompanyDetail> {
  assertCrmAccess(user)

  const [row] = await db
    .select({
      id: companies.id,
      name: companies.name,
      website: companies.website,
      linkedinUrl: companies.linkedinUrl,
      notes: companies.notes,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
      deletedAt: companies.deletedAt,
      isStaff: companies.isStaff,
      billingEndsOn: billingEndsOnSql,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)

  if (!row) {
    throw new NotFoundError('Company not found')
  }
  // Portal access and sign-ins are client records: hidden from anyone who
  // can't manage clients.
  const seesSignIns = roleCan(user.role, 'clients.manage')

  const [memberRows, leadRows, clientRows, formerRows] = await Promise.all([
    listCompanyMembers(companyId),
    db
      .select({
        id: leads.id,
        contactName: contacts.name,
        status: leads.status,
        assigneeName: personNameSql,
        assigneeEmail: users.email,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .innerJoin(contacts, eq(contacts.id, leads.contactId))
      .leftJoin(users, eq(users.id, leads.assigneeId))
      .where(and(eq(leads.companyId, companyId), isNull(leads.deletedAt)))
      .orderBy(desc(leads.updatedAt)),
    // Billed now: the company is its own client.
    db
      .select({ id: companies.id, name: companies.name, slug: companies.slug })
      .from(companies)
      .where(and(eq(companies.id, companyId), isClientCompany())),
    // Billed before (billing stopped), so it can restart.
    db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          wasClientCompany(),
          sql`not ${billingOpenSql()}`
        )
      )
      .limit(1),
  ])

  const signInUserIds = seesSignIns
    ? memberRows.flatMap(member => (member.userId ? [member.userId] : []))
    : []
  const disabledSignIns = new Set(
    signInUserIds.length
      ? (
          await db
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                inArray(users.id, signInUserIds),
                sql`(${users.disabledAt} is not null or ${users.deletedAt} is not null)`
              )
            )
        ).map(signIn => signIn.id)
      : []
  )

  const people = memberRows
    .map(member => ({
      id: member.contactId,
      name: member.name,
      email: member.email,
      jobTitle: member.title,
      linkedinUrl: member.linkedinUrl,
      isPrimary: member.isPrimary,
      portalAccess: seesSignIns && member.portalAccess,
      hasPortalLogin: seesSignIns && Boolean(member.userId),
      signInDisabled: Boolean(
        member.userId && disabledSignIns.has(member.userId)
      ),
    }))
    // Primary contact first.
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  const primary = people.find(person => person.isPrimary)

  return {
    ...row,
    primaryContactId: primary?.id ?? null,
    primaryContactName: primary?.name ?? null,
    clients: clientRows,
    formerClientId: clientRows.length ? null : (formerRows[0]?.id ?? null),
    billingEndsOn: clientRows.length ? row.billingEndsOn : null,
    contacts: people,
    leads: leadRows.map(lead => ({
      id: lead.id,
      contactName: lead.contactName,
      status: lead.status as LeadStatusValue,
      assigneeName: lead.assigneeName ?? lead.assigneeEmail ?? null,
      updatedAt: lead.updatedAt,
    })),
  }
}

export async function listCompanyOptions(
  user: AppUser
): Promise<CompanyOption[]> {
  assertCrmAccess(user)

  return db
    .select({
      id: companies.id,
      name: companies.name,
      website: companies.website,
    })
    .from(companies)
    .where(isNull(companies.deletedAt))
    .orderBy(asc(sql`lower(${companies.name})`))
}

type SaveCompanyValues = z.output<typeof saveCompanySchema>

/** A save the database refused for a reason worth showing (rolls it back). */
export class CompanySaveRefusal extends Error {}

type CompanyFields = {
  name: string
  website: string | null
  linkedinUrl: string | null
  notes: string | null
}

/** A company save, checked and resolved, ready to write in a transaction. */
export type CompanyWritePlan = {
  /** The company being edited; null creates one. */
  existing: { id: string; name: string } | null
  next: CompanyFields
  changedFields: string[]
  before: Record<string, unknown>
  after: Record<string, unknown>
  moves: PeopleMove[]
  titles: { contactId: string; title: string | null }[]
  /** `null` contactId clears the primary; a `null` change leaves it. */
  primaryChange: { contactId: string | null } | null
  primaryContactName: string | null
  /** An edit that changes nothing. */
  unchanged: boolean
}

/**
 * Checks a company save and resolves what it changes, before any write: the
 * fields, the people who join or leave, titles and the primary contact, and
 * the role rules (a client company's name, people and primary are admin-only;
 * so is removing someone from the staff company).
 */
export async function planCompanyWrite(
  actor: AppUser,
  values: SaveCompanyValues
): Promise<
  { ok: true; plan: CompanyWritePlan } | { ok: false; error: string }
> {
  assertCrmAccess(actor)

  const next: CompanyFields = {
    name: values.name,
    website: values.website,
    linkedinUrl: values.linkedinUrl,
    notes: values.notes,
  }
  const titles = values.contactTitles ?? []

  let existing: (CompanyFields & { id: string; isStaff: boolean }) | null = null
  if (values.id) {
    const [row] = await db
      .select({
        id: companies.id,
        name: companies.name,
        website: companies.website,
        linkedinUrl: companies.linkedinUrl,
        notes: companies.notes,
        isStaff: companies.isStaff,
      })
      .from(companies)
      .where(and(eq(companies.id, values.id), isNull(companies.deletedAt)))
      .limit(1)
    if (!row) return { ok: false, error: 'Company not found.' }
    existing = row
  }

  const changedFields: string[] = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  if (existing) {
    const labels: Record<keyof CompanyFields, string> = {
      name: 'name',
      website: 'website',
      linkedinUrl: 'LinkedIn',
      notes: 'notes',
    }
    for (const key of Object.keys(next) as (keyof CompanyFields)[]) {
      if ((existing[key] ?? null) !== (next[key] ?? null)) {
        changedFields.push(labels[key])
        before[key] = existing[key]
        after[key] = next[key]
      }
    }
  }

  const people = await resolvePeopleChanges(
    existing?.id ?? null,
    values.addContactIds ?? [],
    values.removeContactIds ?? []
  )

  // The primary contact (star on the People list) saves in the same
  // transaction as the people it may depend on. `undefined` = unchanged.
  let currentPrimary: string | null = null
  if (existing) {
    const [current] = await db
      .select({ primaryContactId: primaryContactIdSql(companies.id) })
      .from(companies)
      .where(eq(companies.id, existing.id))
      .limit(1)
    currentPrimary = current?.primaryContactId ?? null
  }
  const primaryChange =
    values.primaryContactId !== undefined &&
    values.primaryContactId !== currentPrimary
      ? { contactId: values.primaryContactId }
      : null
  let primaryContactName: string | null = null
  if (primaryChange?.contactId) {
    const [contact] = await db
      .select({ name: contacts.name })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, primaryChange.contactId),
          isNull(contacts.deletedAt)
        )
      )
      .limit(1)
    if (!contact) {
      return { ok: false, error: 'That person is not at this company.' }
    }
    primaryContactName = contact.name
  }

  if (existing) {
    const renamed = next.name !== existing.name
    // A client's name is its company's name, its people are who it bills and
    // gives portal access, and client records are admin-only.
    if (!roleCan(actor.role, 'clients.manage')) {
      const touchesClient =
        renamed ||
        people.moves.length > 0 ||
        titles.length > 0 ||
        primaryChange !== null
      if (touchesClient && (await companyHasClient(existing.id))) {
        return {
          ok: false,
          error: renamed
            ? 'This company is a client, so only an admin can rename it.'
            : people.moves.length || titles.length
              ? 'This company is a client, so only an admin can change its people.'
              : 'This company is a client, so only an admin can change its primary contact.',
        }
      }
    }
    // Staff sign in as members of the agency's own company, so only an admin
    // renames it.
    if (existing.isStaff && renamed && !isAdminRole(actor.role)) {
      return { ok: false, error: `Only an admin can change ${existing.name}.` }
    }
    // Staff sign in as members of the agency's own company.
    if (
      existing.isStaff &&
      !isAdminRole(actor.role) &&
      people.moves.some(move => !move.joins)
    ) {
      return {
        ok: false,
        error: `Only an admin can remove people from ${existing.name}.`,
      }
    }
  }

  // Someone who can sign in sees what their companies give them, so only an
  // admin moves them between companies (as on the person sheet).
  if (!isAdminRole(actor.role) && people.moves.some(move => move.hasSignIn)) {
    return {
      ok: false,
      error:
        'Only an admin can change the companies of someone who can sign in.',
    }
  }

  if (people.moves.length) changedFields.push('people')
  if (titles.length) changedFields.push('titles')

  return {
    ok: true,
    plan: {
      existing: existing ? { id: existing.id, name: existing.name } : null,
      next,
      changedFields,
      before,
      after,
      moves: people.moves,
      titles,
      primaryChange,
      primaryContactName,
      unchanged:
        Boolean(existing) &&
        !changedFields.length &&
        !primaryChange &&
        !people.moves.length,
    },
  }
}

/**
 * Writes a planned company save inside the caller's transaction and returns
 * the company id. A refused primary contact throws `CompanySaveRefusal`, so
 * the whole transaction rolls back.
 */
export async function writeCompany(
  tx: DbTx,
  actor: AppUser,
  plan: CompanyWritePlan
): Promise<string> {
  const timestamp = new Date().toISOString()
  let companyId: string
  if (plan.existing) {
    companyId = plan.existing.id
    if (plan.unchanged) return companyId
    await tx
      .update(companies)
      .set({ ...plan.next, updatedAt: timestamp })
      .where(eq(companies.id, companyId))
  } else {
    const [inserted] = await tx
      .insert(companies)
      .values({
        ...plan.next,
        createdBy: actor.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: companies.id })
    companyId = inserted!.id
  }

  // Joining keeps the person's other companies. Leaving ends their
  // membership here, and with it being this company's primary contact
  // and portal access to its client.
  for (const move of plan.moves) {
    if (move.joins) {
      await joinCompany(tx, move.contactId, companyId)
    } else {
      await leaveCompany(tx, move.contactId, companyId)
    }
  }
  for (const entry of plan.titles) {
    await setMembershipTitle(tx, entry.contactId, companyId, entry.title)
  }

  // After the people moves, so someone joining here can be made primary.
  if (plan.primaryChange) {
    const ok = await setCompanyPrimary(
      tx,
      companyId,
      plan.primaryChange.contactId
    )
    if (!ok) {
      throw new CompanySaveRefusal('That person is not at this company.')
    }
  }
  return companyId
}

/** A company save's activity rows, written once its transaction committed. */
export async function logCompanyWrite(
  actor: AppUser,
  plan: CompanyWritePlan,
  companyId: string
): Promise<void> {
  if (plan.unchanged) return
  const { next } = plan

  if (!plan.existing) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'COMPANY',
      targetId: companyId,
      ...companyCreatedEvent({ name: next.name }),
    })
  } else if (plan.changedFields.length) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'COMPANY',
      targetId: companyId,
      ...companyUpdatedEvent({
        name: next.name,
        changedFields: plan.changedFields,
        details: {
          before: plan.before,
          after: plan.after,
          ...(plan.moves.length
            ? {
                peopleAdded: plan.moves
                  .filter(move => move.joins)
                  .map(move => move.name),
                peopleRemoved: plan.moves
                  .filter(move => !move.joins)
                  .map(move => move.name),
              }
            : {}),
        },
      }),
    })
  }

  if (plan.primaryChange) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'COMPANY',
      targetId: companyId,
      ...companyPrimaryContactSetEvent({
        companyName: next.name,
        contactName: plan.primaryContactName,
      }),
    })
  }

  // Each person's own trail shows the company they joined or left.
  for (const move of plan.moves) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'CONTACT',
      targetId: move.contactId,
      ...contactUpdatedEvent({
        email: move.email,
        name: move.name,
        changedFields: ['companies'],
        details: move.joins
          ? { after: { joinedCompany: next.name } }
          : { before: { leftCompany: next.name } },
      }),
    })
  }
}

/**
 * The words for a company save that failed in its transaction, or null for
 * an unexpected failure (log it and say "Unable to save the company.").
 */
export function companySaveErrorMessage(error: unknown): string | null {
  if (error instanceof CompanySaveRefusal) return error.message
  const constraint = uniqueViolation(error)
  if (constraint) return saveConflictMessage(constraint)
  return null
}

/**
 * Billed now, archived or not: SALES can't archive or restore it (restoring
 * an archived client would put it back into the open month's close).
 */
async function companyHasClient(companyId: string) {
  const [client] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), billingOpenSql()))
    .limit(1)
  return Boolean(client)
}

type PeopleMove = {
  contactId: string
  name: string
  email: string | null
  /** Joins this company (true) or leaves it (false). */
  joins: boolean
  /** Has a sign-in (`contacts.user_id`): admin-only to move. */
  hasSignIn: boolean
}

/**
 * The staged People edits that actually change something: live contacts
 * not yet members (they join; their other companies are untouched) and
 * current members (they leave). Anything else is a stale stage, skipped. A
 * company not created yet (`null`) has no members: everyone added joins.
 */
async function resolvePeopleChanges(
  companyId: string | null,
  addIds: string[],
  removeIds: string[]
): Promise<{ moves: PeopleMove[] }> {
  const removeSet = new Set(companyId ? removeIds : [])
  const adds = [...new Set(addIds)].filter(id => !removeSet.has(id))
  const ids = [...new Set([...adds, ...removeSet])]
  if (!ids.length) return { moves: [] }

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      userId: contacts.userId,
      isMember: companyId
        ? isMemberSql(contacts.id, sql`${companyId}::uuid`)
        : sql<boolean>`false`,
    })
    .from(contacts)
    .where(and(inArray(contacts.id, ids), isNull(contacts.deletedAt)))

  const moves: PeopleMove[] = []
  for (const row of rows) {
    const base = {
      contactId: row.id,
      name: row.name,
      email: row.email,
      hasSignIn: row.userId !== null,
    }
    if (removeSet.has(row.id)) {
      if (row.isMember) moves.push({ ...base, joins: false })
    } else if (!row.isMember) {
      moves.push({ ...base, joins: true })
    }
  }
  return { moves }
}

/**
 * Archiving keeps the company's contacts and leads linked, so a restore
 * brings them back. A company whose billing is still open (billed now, or
 * through the end of this month) can't be archived: stop billing first.
 * Archiving a former client switches off its people's portal access, and a
 * restore doesn't switch it back on.
 */
export async function setCompanyArchived(
  actor: AppUser,
  companyId: string,
  archived: boolean
): Promise<CompanyActionResult> {
  assertCrmAccess(actor)

  const [existing] = await db
    .select({
      id: companies.id,
      name: companies.name,
      deletedAt: companies.deletedAt,
      isStaff: companies.isStaff,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)

  if (!existing) {
    return { ok: false, error: 'Company not found.' }
  }
  if (Boolean(existing.deletedAt) === archived) {
    return { ok: true, id: existing.id }
  }

  // Staff sign in as members of the agency's own company.
  if (existing.isStaff && !isAdminRole(actor.role)) {
    return { ok: false, error: `Only an admin can change ${existing.name}.` }
  }

  // Client records are admin-only, and a client is its company (same rule
  // as rename and people).
  if (
    !roleCan(actor.role, 'clients.manage') &&
    (await companyHasClient(existing.id))
  ) {
    return {
      ok: false,
      error: archived
        ? 'This company is a client, so only an admin can archive it.'
        : 'This company is a client, so only an admin can restore it.',
    }
  }

  if (archived && (await companyHasClient(existing.id))) {
    return { ok: false, error: ARCHIVE_BILLED_REFUSAL }
  }

  const timestamp = new Date().toISOString()
  let accessChanges: ContactClientLinkChange[] = []

  try {
    await db.transaction(async tx => {
      if (archived) {
        // Re-checked under the row lock the company sheet's Save takes, so a
        // billing restart saved meanwhile can't slip past the check above.
        const [locked] = await tx
          .select({ billingOpen: sql<boolean>`${billingOpenSql()}` })
          .from(companies)
          .where(eq(companies.id, companyId))
          .for('update')
        if (locked?.billingOpen) {
          throw new CompanySaveRefusal(ARCHIVE_BILLED_REFUSAL)
        }
      }
      await tx
        .update(companies)
        .set({ deletedAt: archived ? timestamp : null, updatedAt: timestamp })
        .where(eq(companies.id, companyId))
      if (!archived) return
      // Archiving a former client ends its people's portal access, so a
      // later restart doesn't bring it back unasked.
      const [client] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, companyId), wasClientCompany()))
        .limit(1)
      if (client) {
        accessChanges = await revokeCompanyPortalAccess(
          tx,
          companyId,
          client.id
        )
      }
    })
  } catch (error) {
    if (error instanceof CompanySaveRefusal) {
      return { ok: false, error: error.message }
    }
    if (!archived && uniqueViolation(error)) {
      return {
        ok: false,
        error: 'Another company already uses this name. Rename one first.',
      }
    }
    console.error('Failed to change company archive state', error)
    return { ok: false, error: 'Unable to update the company.' }
  }

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    targetType: 'COMPANY',
    targetId: existing.id,
    ...(archived
      ? companyArchivedEvent({ name: existing.name })
      : companyRestoredEvent({ name: existing.name })),
  })
  await logContactClientLinkChanges(actor, accessChanges)

  return { ok: true, id: existing.id }
}

/**
 * The live company with this name (case-insensitive), created when there is
 * none. Lead and contact saves call this so a typed company name always
 * lands on one shared record. Returns null for a blank name.
 */
/** A live company by id, for linking a record to it. */
export async function getLinkableCompany(
  companyId: string,
  executor: DbExecutor = db
): Promise<{ id: string; name: string } | null> {
  const [row] = await executor
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function findOrCreateCompanyByName(
  actor: AppUser,
  rawName: string | null | undefined,
  options: {
    website?: string | null
    executor?: DbExecutor
    /**
     * Inside a transaction, hand the activity write to the caller to run after
     * commit, so a rolled-back save never logs a company that doesn't exist.
     */
    defer?: DeferActivity
  } = {}
): Promise<{ id: string; name: string; created: boolean } | null> {
  const parsedName = companyNameSchema.safeParse(rawName ?? '')
  if (!parsedName.success) return null
  const name = parsedName.data
  const executor = options.executor ?? db

  const findExisting = async () => {
    const [row] = await executor
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(
        and(
          sql`lower(btrim(${companies.name})) = lower(btrim(${name}))`,
          isNull(companies.deletedAt)
        )
      )
      .limit(1)
    return row ?? null
  }

  const existing = await findExisting()
  if (existing) return { ...existing, created: false }

  const timestamp = new Date().toISOString()
  const [inserted] = await executor
    .insert(companies)
    .values({
      name,
      website: normalizeWebAddress(options.website),
      createdBy: actor.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    // Two saves racing on one new name: the loser reads the winner's row.
    .onConflictDoNothing()
    .returning({ id: companies.id, name: companies.name })

  if (inserted) {
    const log = () =>
      logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        targetType: 'COMPANY',
        targetId: inserted.id,
        ...companyCreatedEvent({ name }),
      })
    if (options.defer) options.defer(log)
    else await log()
    return { ...inserted, created: true }
  }

  const raced = await findExisting()
  return raced ? { ...raced, created: false } : null
}

/**
 * Gives a company a website when it has none. A lead save (or a submission
 * promotion) that still carries a website writes it here, since the company
 * owns it; an existing company website is never overwritten.
 */
export async function fillCompanyWebsiteIfBlank(
  actor: AppUser,
  companyId: string,
  rawWebsite: string | null | undefined,
  options: { executor?: DbExecutor; defer?: DeferActivity } = {}
): Promise<void> {
  const website = normalizeWebAddress(rawWebsite)
  if (!website) return
  const executor = options.executor ?? db
  const [updated] = await executor
    .update(companies)
    .set({ website, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(companies.id, companyId),
        sql`nullif(btrim(${companies.website}), '') is null`
      )
    )
    .returning({ id: companies.id, name: companies.name })
  if (!updated) return
  const log = () =>
    logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'COMPANY',
      targetId: updated.id,
      ...companyUpdatedEvent({
        name: updated.name,
        changedFields: ['website'],
        details: { before: { website: null }, after: { website } },
      }),
    })
  if (options.defer) options.defer(log)
  else await log()
}
