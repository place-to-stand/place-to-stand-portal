import { personNameSql } from '@pts/db/names'
import 'server-only'

import { billingOpenSql, isClientCompany, isFormerClientSql, wasClientCompany } from '@pts/db/client-state'

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
  TransactionRollbackError,
} from 'drizzle-orm'

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
  type SaveCompanyInput,
} from '@/lib/companies/schema'
import { db } from '@/lib/db'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { revokeCompanyPortalAccess } from '@/lib/companies/billing/revoke-company-portal-access'
import { companies, contacts, leads, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { LeadStatusValue } from '@/lib/leads/constants'

type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update'>

/** Queues work (an activity write) to run once the caller's transaction commits. */
export type DeferActivity = (task: () => Promise<unknown>) => void

const CLOSED_LEAD_STATUSES_SQL = sql`('CLOSED_WON', 'CLOSED_LOST', 'UNQUALIFIED')`

function isUniqueViolation(error: unknown): boolean {
  const code =
    (error as { code?: string })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code
  return code === '23505'
}

const DUPLICATE_NAME_ERROR = 'A company with this name already exists.'

/** The index a unique violation hit (postgres-js names it constraint_name). */
function violatedConstraint(error: unknown): string | null {
  const read = (value: unknown) =>
    (value as { constraint_name?: string })?.constraint_name ??
    (value as { constraint?: string })?.constraint ??
    null
  return read(error) ?? read((error as { cause?: unknown })?.cause)
}

/** A save's unique violation, in words that match the index it hit. */
function saveConflictMessage(error: unknown): string {
  switch (violatedConstraint(error)) {
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
      // Billed now: the company is its own client.
      clientId: sql<
        string | null
      >`case when ${isClientCompany()} then ${companies.id} end`,
      clientName: sql<
        string | null
      >`case when ${isClientCompany()} then ${companies.name} end`,
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
    clientId: row.clientId ?? null,
    clientName: row.clientName ?? null,
    formerClient: Boolean(row.formerClient),
    people: row.people ?? [],
    openLeads: row.openLeads ?? [],
    contactCount: row.people?.length ?? 0,
    openLeadCount: row.openLeads?.length ?? 0,
    primaryContactName: row.primaryContactName ?? null,
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
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)

  if (!row) {
    throw new NotFoundError('Company not found')
  }

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

  const people = memberRows
    .map(member => ({
      id: member.contactId,
      name: member.name,
      email: member.email,
      jobTitle: member.title,
      linkedinUrl: member.linkedinUrl,
      isPrimary: member.isPrimary,
      portalAccess: member.portalAccess,
      hasPortalLogin: Boolean(member.userId),
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

export async function saveCompany(
  actor: AppUser,
  input: SaveCompanyInput
): Promise<CompanyActionResult> {
  assertCrmAccess(actor)

  const parsed = saveCompanySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid company details.',
    }
  }

  const values = parsed.data

  const timestamp = new Date().toISOString()

  if (!values.id) {
    try {
      const [inserted] = await db
        .insert(companies)
        .values({
          name: values.name,
          website: values.website,
          linkedinUrl: values.linkedinUrl,
          notes: values.notes,
          createdBy: actor.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning({ id: companies.id })

      await logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        targetType: 'COMPANY',
        targetId: inserted!.id,
        ...companyCreatedEvent({ name: values.name }),
      })

      return { ok: true, id: inserted!.id }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { ok: false, error: saveConflictMessage(error) }
      }
      console.error('Failed to create company', error)
      return { ok: false, error: 'Unable to save the company.' }
    }
  }

  const [existing] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, values.id), isNull(companies.deletedAt)))
    .limit(1)

  if (!existing) {
    return { ok: false, error: 'Company not found.' }
  }

  const next = {
    name: values.name,
    website: values.website,
    linkedinUrl: values.linkedinUrl,
    notes: values.notes,
  }

  const changedFields: string[] = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  const labels: Record<keyof typeof next, string> = {
    name: 'name',
    website: 'website',
    linkedinUrl: 'LinkedIn',
    notes: 'notes',
  }
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if ((existing[key] ?? null) !== (next[key] ?? null)) {
      changedFields.push(labels[key])
      before[key] = existing[key]
      after[key] = next[key]
    }
  }

  const people = await resolvePeopleChanges(
    existing.id,
    values.addContactIds ?? [],
    values.removeContactIds ?? []
  )

  // The primary contact (star on the People list) saves in the same
  // transaction as the people it may depend on. `undefined` = unchanged.
  const [current] = await db
    .select({ primaryContactId: primaryContactIdSql(companies.id) })
    .from(companies)
    .where(eq(companies.id, existing.id))
    .limit(1)
  const primaryChange =
    values.primaryContactId !== undefined &&
    values.primaryContactId !== (current?.primaryContactId ?? null)
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

  if (
    !changedFields.length &&
    !primaryChange &&
    !people.moves.length &&
    !(values.contactTitles ?? []).length
  ) {
    return { ok: true, id: existing.id }
  }

  const renamed = next.name !== existing.name
  // A client's name is its company's name, its people are who it bills and
  // gives portal access, and client records are admin-only.
  if (!roleCan(actor.role, 'clients.manage')) {
    if (renamed && (await companyHasClient(existing.id))) {
      return {
        ok: false,
        error: 'This company is a client, so only an admin can rename it.',
      }
    }
    if (people.moves.length && (await companyHasClient(existing.id))) {
      return {
        ok: false,
        error:
          'This company is a client, so only an admin can change its people.',
      }
    }
    if (primaryChange && (await companyHasClient(existing.id))) {
      return {
        ok: false,
        error:
          'This company is a client, so only an admin can change its primary contact.',
      }
    }
  }

  if (people.moves.length) {
    changedFields.push('people')
  }
  if ((values.contactTitles ?? []).length) {
    changedFields.push('titles')
  }

  // Portal access ended by unlinking or moving a client, logged after commit.
  const accessChanges: ContactClientLinkChange[] = []
  try {
    await db.transaction(async tx => {
      await tx
        .update(companies)
        .set({ ...next, updatedAt: timestamp })
        .where(eq(companies.id, existing.id))

      // Joining keeps the person's other companies. Leaving ends their
      // membership here, and with it being this company's primary contact
      // and portal access to its client.
      for (const move of people.moves) {
        if (move.joins) {
          await joinCompany(tx, move.contactId, existing.id)
        } else {
          await leaveCompany(tx, move.contactId, existing.id)
        }
      }
      for (const entry of values.contactTitles ?? []) {
        await setMembershipTitle(tx, entry.contactId, existing.id, entry.title)
      }

      // After the people moves, so someone joining here can be made primary.
      // A refusal rolls the whole save back.
      if (primaryChange) {
        const ok = await setCompanyPrimary(
          tx,
          existing.id,
          primaryChange.contactId
        )
        if (!ok) tx.rollback()
      }
    })
  } catch (error) {
    if (error instanceof TransactionRollbackError) {
      return { ok: false, error: 'That person is not at this company.' }
    }
    if (isUniqueViolation(error)) {
      return { ok: false, error: saveConflictMessage(error) }
    }
    console.error('Failed to update company', error)
    return { ok: false, error: 'Unable to save the company.' }
  }

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    targetType: 'COMPANY',
    targetId: existing.id,
    ...companyUpdatedEvent({
      name: next.name,
      changedFields,
      details: {
        before,
        after,
        ...(people.moves.length
          ? {
              peopleAdded: people.moves
                .filter(move => move.joins)
                .map(move => move.name),
              peopleRemoved: people.moves
                .filter(move => !move.joins)
                .map(move => move.name),
            }
          : {}),
      },
    }),
  })

  await logContactClientLinkChanges(actor, accessChanges)

  if (primaryChange) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'COMPANY',
      targetId: existing.id,
      ...companyPrimaryContactSetEvent({
        companyName: next.name,
        contactName: primaryContactName,
      }),
    })
  }

  // Each person's own trail shows the company they joined or left.
  for (const move of people.moves) {
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

  return { ok: true, id: existing.id }
}

/**
 * Billed now, archived or not: SALES can't archive or restore it (restoring
 * an archived client would put it back into the open month's close).
 */
async function companyHasClient(companyId: string) {
  const [client] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.id, companyId),
        billingOpenSql()
      )
    )
    .limit(1)
  return Boolean(client)
}

type PeopleMove = {
  contactId: string
  name: string
  email: string | null
  /** Joins this company (true) or leaves it (false). */
  joins: boolean
}

/**
 * The staged People edits that actually change something: live contacts
 * not yet members (they join; their other companies are untouched) and
 * current members (they leave). Anything else is a stale stage, skipped.
 */
async function resolvePeopleChanges(
  companyId: string,
  addIds: string[],
  removeIds: string[]
): Promise<{ moves: PeopleMove[] }> {
  const removeSet = new Set(removeIds)
  const adds = [...new Set(addIds)].filter(id => !removeSet.has(id))
  const ids = [...new Set([...adds, ...removeSet])]
  if (!ids.length) return { moves: [] }

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      isMember: isMemberSql(contacts.id, sql`${companyId}::uuid`),
    })
    .from(contacts)
    .where(and(inArray(contacts.id, ids), isNull(contacts.deletedAt)))

  const moves: PeopleMove[] = []
  for (const row of rows) {
    const base = { contactId: row.id, name: row.name, email: row.email }
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
 * brings them back. Portal access to its client ends (same as unlinking or
 * archiving the client) and is not switched back on by a restore.
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

  const timestamp = new Date().toISOString()
  let accessChanges: ContactClientLinkChange[] = []

  try {
    await db.transaction(async tx => {
      await tx
        .update(companies)
        .set({ deletedAt: archived ? timestamp : null, updatedAt: timestamp })
        .where(eq(companies.id, companyId))
      if (!archived) return
      // Archiving a client company ends its people's portal access.
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
    if (!archived && isUniqueViolation(error)) {
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

/** The company a client is: itself (a client is a company you bill). */
export async function getClientCompanyId(
  clientId: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, clientId), wasClientCompany()))
    .limit(1)
  return row?.id ?? null
}
