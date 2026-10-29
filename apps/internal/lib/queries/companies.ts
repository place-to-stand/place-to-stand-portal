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
      clientName: sql<string | null>`(
        select cl.name from clients cl
        where cl.company_id = companies.id and cl.deleted_at is null
        order by cl.created_at limit 1
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
        assigneeName: users.fullName,
        assigneeEmail: users.email,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .innerJoin(contacts, eq(contacts.id, leads.contactId))
      .leftJoin(users, eq(users.id, leads.assigneeId))
      .where(and(eq(leads.companyId, companyId), isNull(leads.deletedAt)))
      .orderBy(desc(leads.updatedAt)),
    db
      .select({ id: clients.id, name: clients.name, slug: clients.slug })
      .from(clients)
      .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
      .orderBy(asc(clients.name)),
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
        return { ok: false, error: DUPLICATE_NAME_ERROR }
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
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(
          and(
            inArray(clients.id, values.unlinkClientIds ?? []),
            eq(clients.companyId, existing.id),
            isNull(clients.deletedAt)
          )
        )
    : []
  // A company has one client (an unlink in the same save frees the slot).
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

  if (
    !changedFields.length &&
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
          'This company is a client, so only an admin can change its contacts.',
      }
    }
  }

  if (people.moves.length) {
    changedFields.push('contacts')
  }
  if ((values.contactTitles ?? []).length) {
    changedFields.push('titles')
  }
  if (clientMoves.length || unlinkIds.length) {
    changedFields.push('linked client')
  }

  try {
    await db.transaction(async tx => {
      await tx
        .update(companies)
        .set({ ...next, updatedAt: timestamp })
        .where(eq(companies.id, existing.id))

      // A client is named after its company; follow a rename.
      if (renamed) {
        await tx
          .update(clients)
          .set({
            name: clientDisplayName(next.name),
            updatedAt: timestamp,
          })
          .where(eq(clients.companyId, existing.id))
      }

      // Unlink first so the one-client index allows the new link.
      for (const client of unlinkIds) {
        await tx
          .update(clients)
          .set({ companyId: null, updatedAt: timestamp })
          .where(eq(clients.id, client.id))
      }

      // A client is named after its company.
      for (const move of clientMoves) {
        await tx
          .update(clients)
          .set({
            companyId: existing.id,
            name: clientDisplayName(next.name),
            updatedAt: timestamp,
          })
          .where(eq(clients.id, move.clientId))
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
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: DUPLICATE_NAME_ERROR }
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
      name: clients.name,
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
      name: clients.name,
      companyId: clients.companyId,
      companyName: companies.name,
    })
    .from(clients)
    .leftJoin(companies, eq(companies.id, clients.companyId))
    // Only clients not linked to a company: a company has one client.
    .where(and(isNull(clients.deletedAt), isNull(clients.companyId)))
    .orderBy(asc(sql`lower(${clients.name})`))
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
 * brings everything back as it was.
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

  const timestamp = new Date().toISOString()

  try {
    await db
      .update(companies)
      .set({ deletedAt: archived ? timestamp : null, updatedAt: timestamp })
      .where(eq(companies.id, companyId))
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
      return { ok: false, error: 'That contact is not at this company.' }
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
    return { ok: false, error: 'That contact is not at this company.' }
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
