import { currentBillingTypeSql } from '@pts/db/terms'
import { getClientHoursTotals } from '@pts/db/hours'
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

import {
  listCompanyMembers,
  primaryContactNameSql,
} from '@/lib/queries/memberships'
import { roleCan } from '@/lib/auth/capabilities'
import {
  currentOriginationContactIdSql,
  currentOriginationUserIdSql,
  fetchLatestClosersByClient,
} from '@/lib/queries/companies/billing/commission-terms'
import { assertCan } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import type {
  CompanyDetail,
  CompanyListItem,
  CompanyOption,
} from '@/lib/companies/types'
import { db } from '@/lib/db'
import { ARCHIVE_BILLED_REFUSAL } from '@/lib/companies/archive-refusal'
import { companies, contacts, leads, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import { companySearchHintsSql } from '@/lib/queries/companies/search-hints'
import type { LeadStatusValue } from '@/lib/leads/constants'

const CLOSED_LEAD_STATUSES_SQL = sql`('CLOSED_WON', 'CLOSED_LOST', 'UNQUALIFIED')`

/** Escape LIKE wildcards so a search for "50%" means the literal text. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

export async function listCompanies(
  user: AppUser,
  options: { status?: 'active' | 'archived'; search?: string | null } = {}
): Promise<CompanyListItem[]> {
  assertCan(user, 'companies.manage')

  const status = options.status ?? 'active'
  const search = options.search?.trim() ?? ''

  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      website: companies.website,
      slug: companies.slug,
      isStaff: companies.isStaff,
      billingType: currentBillingTypeSql(),
      originationUserId: currentOriginationUserIdSql(),
      originationContactId: currentOriginationContactIdSql(),
      originationName: sql<string | null>`coalesce(
        -- A user is called by their contact's name (see personNameOf).
        (select uc.name from contacts uc
          where uc.user_id = ${currentOriginationUserIdSql()}),
        (select u.email from users u
          where u.id = ${currentOriginationUserIdSql()}),
        (select oc.name from contacts oc
          where oc.id = ${currentOriginationContactIdSql()})
      )`,
      projects: sql<CompanyListItem['projects']>`coalesce((
        select json_agg(
          json_build_object('id', p.id, 'name', p.name, 'slug', p.slug)
          order by lower(p.name)
        )
        from projects p
        where p.company_id = companies.id and p.deleted_at is null
      ), '[]'::json)`,
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

  // Billing and commission are for people who manage clients.
  const seesBilling = roleCan(user.role, 'clients.manage')
  const clientIds = rows.filter(row => row.isClient).map(row => row.id)
  const [closersByClient, hoursByClient] = seesBilling
    ? await Promise.all([
        fetchLatestClosersByClient(clientIds),
        getClientHoursTotals(
          db,
          rows
            .filter(row => row.isClient && row.billingType === 'prepaid')
            .map(row => row.id)
        ),
      ])
    : [new Map(), new Map()]

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    website: row.website,
    slug: row.slug,
    billingType: seesBilling && row.isClient ? row.billingType : null,
    origination:
      seesBilling && row.isClient && row.originationName
        ? {
            userId: row.originationUserId ?? null,
            contactId: row.originationContactId ?? null,
            name: row.originationName,
          }
        : null,
    closers: (closersByClient.get(row.id) ?? []).map(
      (closer: { kind: 'user' | 'contact'; id: string; name: string }) => ({
        kind: closer.kind,
        id: closer.id,
        name: closer.name,
      })
    ),
    projects: row.projects ?? [],
    // Prepaid clients only: none bought or logged yet reads as 0 of 0.
    hours:
      seesBilling && row.isClient && row.billingType === 'prepaid'
        ? {
            remaining: hoursByClient.get(row.id)?.remaining ?? 0,
            purchased: hoursByClient.get(row.id)?.purchased ?? 0,
          }
        : null,
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
      row.isStaff && !roleCan(user.role, 'directory.staff_company')
        ? `Only an admin can change ${row.name}.`
        : row.isClient && !row.deletedAt
          ? ARCHIVE_BILLED_REFUSAL
          : null,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  }))
}

export async function countCompanies(user: AppUser) {
  assertCan(user, 'companies.manage')
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
  assertCan(user, 'companies.manage')

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
  const signInRows = signInUserIds.length
    ? await db
        .select({
          id: users.id,
          role: users.role,
          off: sql<boolean>`(${users.disabledAt} is not null or ${users.deletedAt} is not null)`,
        })
        .from(users)
        .where(inArray(users.id, signInUserIds))
    : []
  const disabledSignIns = new Set(
    signInRows.filter(signIn => signIn.off).map(signIn => signIn.id)
  )
  const signInRoles = new Map(
    signInRows.map(signIn => [signIn.id, signIn.role])
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
      signInLocked:
        !roleCan(user.role, 'settings.users') && Boolean(member.userId),
      signInDisabled: Boolean(
        seesSignIns && member.userId && disabledSignIns.has(member.userId)
      ),
      signInRole: member.userId
        ? (signInRoles.get(member.userId) ?? null)
        : null,
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
    // When billing ends is billing information: admins only.
    billingEndsOn: seesSignIns && clientRows.length ? row.billingEndsOn : null,
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
  assertCan(user, 'companies.manage')

  return db
    .select({
      id: companies.id,
      name: companies.name,
      website: companies.website,
      searchHints: companySearchHintsSql(),
    })
    .from(companies)
    .where(isNull(companies.deletedAt))
    .orderBy(asc(sql`lower(${companies.name})`))
}
