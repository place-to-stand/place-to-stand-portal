import 'server-only'

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  ne,
  sql,
} from 'drizzle-orm'

import {
  companyArchivedEvent,
  companyChampionSetEvent,
  companyCreatedEvent,
  companyRestoredEvent,
  companyUpdatedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
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
import { clients, companies, contacts, leads, users } from '@/lib/db/schema'
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
      clientId: companies.clientId,
      clientName: clients.name,
      updatedAt: companies.updatedAt,
      deletedAt: companies.deletedAt,
      contactCount: sql<number>`(
        select count(*) from contacts ct
        where ct.company_id = companies.id and ct.deleted_at is null
      )`,
      openLeadCount: sql<number>`(
        select count(*) from leads l
        where l.company_id = companies.id
          and l.deleted_at is null
          and l.status not in ${CLOSED_LEAD_STATUSES_SQL}
      )`,
      championName: sql<string | null>`(
        select ct.name from contacts ct
        where ct.company_id = companies.id
          and ct.deleted_at is null
          and ct.is_champion
        order by ct.updated_at desc
        limit 1
      )`,
    })
    .from(companies)
    .leftJoin(
      clients,
      and(eq(clients.id, companies.clientId), isNull(clients.deletedAt))
    )
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
    clientId: row.clientName ? row.clientId : null,
    clientName: row.clientName ?? null,
    contactCount: Number(row.contactCount ?? 0),
    openLeadCount: Number(row.openLeadCount ?? 0),
    championName: row.championName ?? null,
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
      clientId: companies.clientId,
      clientName: clients.name,
      clientSlug: clients.slug,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
      deletedAt: companies.deletedAt,
    })
    .from(companies)
    .leftJoin(
      clients,
      and(eq(clients.id, companies.clientId), isNull(clients.deletedAt))
    )
    .where(eq(companies.id, companyId))
    .limit(1)

  if (!row) {
    throw new NotFoundError('Company not found')
  }

  const [contactRows, leadRows] = await Promise.all([
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        jobTitle: contacts.jobTitle,
        linkedinUrl: contacts.linkedinUrl,
        isChampion: contacts.isChampion,
      })
      .from(contacts)
      .where(and(eq(contacts.companyId, companyId), isNull(contacts.deletedAt)))
      .orderBy(desc(contacts.isChampion), asc(contacts.name)),
    db
      .select({
        id: leads.id,
        contactName: leads.contactName,
        status: leads.status,
        assigneeName: users.fullName,
        assigneeEmail: users.email,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .leftJoin(users, eq(users.id, leads.assigneeId))
      .where(and(eq(leads.companyId, companyId), isNull(leads.deletedAt)))
      .orderBy(desc(leads.updatedAt)),
  ])

  return {
    ...row,
    clientId: row.clientName ? row.clientId : null,
    clientName: row.clientName ?? null,
    clientSlug: row.clientSlug ?? null,
    contacts: contactRows,
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
    .select({ id: companies.id, name: companies.name })
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

  if (!changedFields.length) {
    return { ok: true, id: existing.id }
  }

  try {
    await db.transaction(async tx => {
      await tx
        .update(companies)
        .set({ ...next, updatedAt: timestamp })
        .where(eq(companies.id, existing.id))

      // Leads keep a display copy of the company name; follow a rename.
      if (next.name !== existing.name) {
        await tx
          .update(leads)
          .set({ companyName: next.name, updatedAt: timestamp })
          .where(eq(leads.companyId, existing.id))
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
      details: { before, after },
    }),
  })

  return { ok: true, id: existing.id }
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

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** True for a write that would leave a company with two champions. */
export function isChampionConflict(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.message} ${String(error.cause ?? '')}`
      : ''
  return text.includes('idx_contacts_one_champion')
}

/**
 * Inside a transaction: makes `contactId` the company's only champion, or
 * clears the champion with `null`. Locks the company row first so two
 * champion changes at one company run one after the other; the unique
 * index `idx_contacts_one_champion` backs this up.
 */
export async function assignChampion(
  tx: DbTransaction,
  companyId: string,
  contactId: string | null
): Promise<void> {
  await tx.execute(
    sql`select 1 from companies where id = ${companyId} for update`
  )

  const timestamp = new Date().toISOString()

  await tx
    .update(contacts)
    .set({ isChampion: false, updatedAt: timestamp })
    .where(
      and(
        eq(contacts.companyId, companyId),
        eq(contacts.isChampion, true),
        contactId ? ne(contacts.id, contactId) : undefined
      )
    )

  if (contactId) {
    await tx
      .update(contacts)
      .set({ isChampion: true, updatedAt: timestamp })
      .where(eq(contacts.id, contactId))
  }
}

/**
 * Makes one contact the company's champion (or clears it with `null`).
 * A company has at most one champion, so every other contact there loses
 * the flag.
 */
export async function setCompanyChampion(
  actor: AppUser,
  companyId: string,
  contactId: string | null
): Promise<CompanyActionResult> {
  assertCrmAccess(actor)

  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1)

  if (!company) {
    return { ok: false, error: 'Company not found.' }
  }

  let contactName: string | null = null

  if (contactId) {
    const [contact] = await db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, companyId),
          isNull(contacts.deletedAt)
        )
      )
      .limit(1)

    if (!contact) {
      return { ok: false, error: 'That contact is not at this company.' }
    }
    contactName = contact.name
  }

  try {
    await db.transaction(tx => assignChampion(tx, companyId, contactId))
  } catch (error) {
    if (isChampionConflict(error)) {
      return {
        ok: false,
        error: 'Someone else just changed the champion. Reload and try again.',
      }
    }
    throw error
  }

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    targetType: 'COMPANY',
    targetId: company.id,
    ...companyChampionSetEvent({ companyName: company.name, contactName }),
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

/** Live company by id, or null. */
export async function getLiveCompany(companyId: string) {
  const [row] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1)
  return row ?? null
}
