import { clientNameSql, personNameSql } from '@pts/db/names'
import 'server-only'

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
  clientUpdatedEvent,
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
import { clientDisplayName } from '@/lib/companies/client-name'
import type {
  ClientLinkOption,
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
import { revokeCompanyPortalAccess } from '@/lib/settings/clients/revoke-company-portal-access'
import {
  clients,
  companies,
  contacts,
  leads,
  memberships,
  users,
} from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { LeadStatusValue } from '@/lib/leads/constants'

type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update'>

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
    case 'clients_company_id_live_key':
      return 'A company has one client, and this one already has it. Reload and try again.'
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
      // A company's client: its earliest live client (most have one).
      clientId: sql<string | null>`(
        select cl.id from clients cl
        where cl.company_id = companies.id and cl.deleted_at is null
        order by cl.created_at limit 1
      )`,
      // A client is called by its company's name.
      clientName: sql<string | null>`(
        select companies.name where exists (
          select 1 from clients cl
          where cl.company_id = companies.id and cl.deleted_at is null
        )
      )`,
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

  const [memberRows, leadRows, clientRows] = await Promise.all([
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
    db
      .select({ id: clients.id, name: clientNameSql, slug: clients.slug })
      .from(clients)
      .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
      .orderBy(asc(clientNameSql)),
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

  const clientMoves = await resolveClientMoves(
    existing.id,
    values.addClientIds ?? []
  )
  // Unlinking only applies to a client linked here now.
  const unlinkIds = (values.unlinkClientIds ?? []).length
    ? await db
        .select({ id: clients.id, name: clientNameSql })
        .from(clients)
        .where(
          and(
            inArray(clients.id, values.unlinkClientIds ?? []),
            eq(clients.companyId, existing.id),
            isNull(clients.deletedAt)
          )
        )
    : []
  // A client is its company's billing record: it can't be unlinked (archive
  // the client to stop billing).
  if (unlinkIds.length) {
    return {
      ok: false,
      error:
        'Billing belongs to its company. Archive the client to stop billing.',
    }
  }
  // A company has one client.
  if (
    clientMoves.length > 1 ||
    (clientMoves.length === 1 &&
      !unlinkIds.length &&
      (await companyHasClient(existing.id)))
  ) {
    return {
      ok: false,
      error: 'A company has one client, and this one already has it.',
    }
  }

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
    !(values.contactTitles ?? []).length &&
    !clientMoves.length &&
    !unlinkIds.length
  ) {
    return { ok: true, id: existing.id }
  }

  const renamed = next.name !== existing.name
  // A client's name is its company's name, its people are who it bills and
  // gives portal access, and client records are admin-only.
  if (!roleCan(actor.role, 'clients.manage')) {
    if (clientMoves.length || unlinkIds.length) {
      return { ok: false, error: 'Only an admin can link or unlink clients.' }
    }
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
  if (clientMoves.length || unlinkIds.length) {
    changedFields.push('linked client')
  }

  // Portal access ended by unlinking or moving a client, logged after commit.
  const accessChanges: ContactClientLinkChange[] = []
  try {
    await db.transaction(async tx => {
      await tx
        .update(companies)
        .set({ ...next, updatedAt: timestamp })
        .where(eq(companies.id, existing.id))

      // Unlink first so the one-client index allows the new link. Access is
      // a flag on this company's memberships: switch it off so the next
      // client linked here doesn't silently inherit it.

      // A client takes its company's name (read through the company).
      for (const move of clientMoves) {
        await tx
          .update(clients)
          .set({
            companyId: existing.id,
            updatedAt: timestamp,
          })
          .where(eq(clients.id, move.clientId))
        // A client moving here leaves its old company's people behind.
        if (move.fromCompanyId) {
          accessChanges.push(
            ...(await revokeCompanyPortalAccess(
              tx,
              move.fromCompanyId,
              move.clientId
            ))
          )
        }
      }

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
        ...(clientMoves.length
          ? { clientsLinked: clientMoves.map(move => move.name) }
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

  for (const client of unlinkIds) {
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'CLIENT',
      targetId: client.id,
      targetClientId: client.id,
      ...clientUpdatedEvent({
        name: client.name,
        changedFields: ['company'],
        details: {
          before: { companyId: existing.id },
          after: { companyId: null },
        },
      }),
    })
  }

  for (const move of clientMoves) {
    const nextName = clientDisplayName(next.name)
    const nameChanged = nextName !== move.name
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'CLIENT',
      targetId: move.clientId,
      targetClientId: move.clientId,
      ...clientUpdatedEvent({
        name: nextName,
        changedFields: nameChanged ? ['company', 'name'] : ['company'],
        details: {
          before: {
            companyId: move.fromCompanyId,
            ...(nameChanged ? { name: move.name } : {}),
          },
          after: {
            companyId: existing.id,
            ...(nameChanged ? { name: nextName } : {}),
          },
        },
      }),
    })
  }

  return { ok: true, id: existing.id }
}

/** Live clients being linked here that aren't already. */
async function resolveClientMoves(companyId: string, clientIds: string[]) {
  const ids = [...new Set(clientIds)]
  if (!ids.length) return []
  const rows = await db
    .select({
      clientId: clients.id,
      name: clientNameSql,
      fromCompanyId: clients.companyId,
    })
    .from(clients)
    .where(and(inArray(clients.id, ids), isNull(clients.deletedAt)))
  return rows.filter(row => row.fromCompanyId !== companyId)
}

/** Unlinked live clients for the company sheet's Linked client picker. */
export async function listClientLinkOptions(): Promise<ClientLinkOption[]> {
  const rows = await db
    .select({
      id: clients.id,
      name: clientNameSql,
      companyId: clients.companyId,
      companyName: companies.name,
    })
    .from(clients)
    .leftJoin(companies, eq(companies.id, clients.companyId))
    // Only clients not linked to a company: a company has one client.
    .where(and(isNull(clients.deletedAt), isNull(clients.companyId)))
    .orderBy(asc(sql`lower(${clientNameSql})`))
  return rows
}

async function companyHasClient(companyId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
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
      const [client] = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
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
 * Makes one contact the company's primary contact (or clears it with
 * `null`). Clients use their company's primary contact. The contact must be
 * at this company; one with no company on record joins it.
 */
export async function setCompanyPrimaryContact(
  actor: AppUser,
  companyId: string,
  contactId: string | null
): Promise<CompanyActionResult> {
  assertCrmAccess(actor)

  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      primaryContactId: primaryContactIdSql(companies.id),
    })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1)

  if (!company) {
    return { ok: false, error: 'Company not found.' }
  }
  if (company.primaryContactId === contactId) {
    return { ok: true, id: company.id }
  }

  // A client's company primary contact is its default invoice and update
  // recipient, and client records are admin-only.
  if (
    !roleCan(actor.role, 'clients.manage') &&
    (await companyHasClient(companyId))
  ) {
    return {
      ok: false,
      error:
        'This company is a client, so only an admin can change its primary contact.',
    }
  }

  let contactName: string | null = null
  if (contactId) {
    const [contact] = await db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
      .limit(1)
    if (!contact) {
      return { ok: false, error: 'That person is not at this company.' }
    }
    contactName = contact.name
  }

  const set = await db
    .transaction(async tx => {
      // Only a member can be primary; one with no companies joins this one.
      // A refusal throws so nothing in the transaction commits.
      if (contactId) {
        const [anyMembership] = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .where(
            and(
              isNull(memberships.endedAt),
              eq(memberships.contactId, contactId)
            )
          )
          .limit(1)
        if (!anyMembership) await joinCompany(tx, contactId, companyId)
      }
      const ok = await setCompanyPrimary(tx, companyId, contactId)
      if (!ok) tx.rollback()
      return ok
    })
    .catch(error => {
      if (error instanceof TransactionRollbackError) return false
      // Someone else changed the primary at the same moment.
      if (isUniqueViolation(error)) return 'conflict' as const
      throw error
    })
  if (set === 'conflict') {
    return {
      ok: false,
      error: 'The primary contact just changed. Reload and try again.',
    }
  }
  if (!set) {
    return { ok: false, error: 'That person is not at this company.' }
  }

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    targetType: 'COMPANY',
    targetId: company.id,
    ...companyPrimaryContactSetEvent({
      companyName: company.name,
      contactName,
    }),
  })

  return { ok: true, id: company.id }
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
  options: { website?: string | null; executor?: DbExecutor } = {}
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
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'COMPANY',
      targetId: inserted.id,
      ...companyCreatedEvent({ name }),
    })
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
  rawWebsite: string | null | undefined
): Promise<void> {
  const website = normalizeWebAddress(rawWebsite)
  if (!website) return
  const [updated] = await db
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
  await logActivity({
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
}

/** The company a client is, or null. */
export async function getClientCompanyId(
  clientId: string
): Promise<string | null> {
  const [row] = await db
    .select({ companyId: clients.companyId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)
  return row?.companyId ?? null
}

/** Live company by id, or null. */
export async function getLiveCompany(companyId: string) {
  const [row] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1)
  return row ?? null
}
