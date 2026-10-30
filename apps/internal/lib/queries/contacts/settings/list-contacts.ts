import { isClientCompany } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import 'server-only'

import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { companies, clientPortalAccess, contacts } from '@/lib/db/schema'
import { type PageInfo } from '@/lib/pagination/cursor'
import {
  decodeSortCursor,
  encodeSortCursor,
  type SortCursorPayload,
  type SortDirection,
} from '@/lib/pagination/sort'
import {
  DEFAULT_CONTACTS_SORT,
  type SignInFilter,
} from '@/lib/settings/contacts/filters'
import { canSeePortalAccess } from '@/lib/settings/contacts/portal-visibility'
import {
  listContactMemberships,
  type ContactMembership,
} from '@/lib/queries/memberships'

import {
  contactFields,
  contactProfileFields,
  type ContactProfile,
  type SelectContact,
} from '../selectors'
import {
  buildClientCondition,
  buildSearchCondition,
  buildStatusCondition,
  CONTACT_SORT_DESCRIPTORS,
  linkedClientsCountSql,
  normalizeStatus,
  resolveContactDirection,
  resolvePaginationLimit,
  type ContactSortDescriptor,
  type StatusFilter,
} from './pagination'
import type {
  ContactsSettingsListItem,
  ContactsSettingsResult,
  LinkedClient,
  ListContactsForSettingsInput,
} from './types'

type ContactMetricsResult = SelectContact &
  ContactProfile & {
    totalClients: number | string | null
    userHasPhoto: boolean | null
    signInRole: 'ADMIN' | 'SALES' | 'CLIENT' | null
  }

/** People with (or without) a live sign-in, optionally of one role. */
function buildSignInCondition(signIn: SignInFilter | null | undefined) {
  if (!signIn) return null
  // The outer contact column is written table-qualified: interpolated, drizzle
  // may drop the table name and it would bind inside the subquery.
  const live = sql`exists (select 1 from users u where u.id = ${sql.raw('"contacts"."user_id"')} and u.deleted_at is null${
    signIn === 'any' || signIn === 'none' ? sql`` : sql` and u.role = ${signIn}`
  })`
  return signIn === 'none' ? sql`not ${live}` : live
}

function buildBaseConditions(
  status: StatusFilter,
  searchQuery: string,
  clientCompanyId: string | null | undefined,
  signIn?: SignInFilter | null,
  clientMatch: 'portal' | 'member' = 'portal'
): SQL[] {
  const conditions: SQL[] = [buildStatusCondition(status)]

  const searchCondition = buildSearchCondition(searchQuery)
  if (searchCondition) {
    conditions.push(searchCondition)
  }

  const clientCondition = buildClientCondition(clientCompanyId, clientMatch)
  if (clientCondition) {
    conditions.push(clientCondition)
  }

  const signInCondition = buildSignInCondition(signIn)
  if (signInCondition) {
    conditions.push(signInCondition)
  }

  return conditions
}

async function queryContactRows(
  whereClause: SQL | undefined,
  ordering: SQL[],
  limit: number,
  opts?: { offset?: number }
) {
  // Correlated subquery instead of a join + GROUP BY: it counts only live
  // clients with portal access (the MCP directory reports it).
  const query = db
    .select({
      ...contactFields,
      ...contactProfileFields,
      totalClients: linkedClientsCountSql,
      // They have a photo (the list's avatar).
      userHasPhoto: sql<boolean>`("contacts"."avatar_url" is not null)`,
      signInRole: sql<'ADMIN' | 'SALES' | 'CLIENT' | null>`(
        select u.role from users u
        where u.id = "contacts"."user_id"
          and u.deleted_at is null and u.disabled_at is null
      )`,
    })
    .from(contacts)
    .where(whereClause)
    .orderBy(...ordering)

  if (typeof opts?.offset === 'number') {
    return query.limit(limit).offset(opts.offset) as Promise<
      ContactMetricsResult[]
    >
  }

  return query.limit(limit + 1) as Promise<ContactMetricsResult[]>
}

async function fetchClientDetails(
  contactIds: string[]
): Promise<Map<string, LinkedClient[]>> {
  if (contactIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .select({
      contactId: clientPortalAccess.contactId,
      clientCompanyId: companies.id,
      clientName: clientNameSql,
      clientSlug: companies.slug,
      companyId: companies.id,
    })
    .from(clientPortalAccess)
    .innerJoin(companies, eq(clientPortalAccess.companyId, companies.id))
    .where(
      and(
        inArray(clientPortalAccess.contactId, contactIds),
        isClientCompany()
      )
    )
    .orderBy(asc(clientNameSql))

  const result = new Map<string, LinkedClient[]>()
  for (const row of rows) {
    const existing = result.get(row.contactId) ?? []
    existing.push({
      id: row.clientCompanyId,
      name: row.clientName,
      slug: row.clientSlug ?? row.clientCompanyId,
      companyId: row.companyId,
    })
    result.set(row.contactId, existing)
  }

  return result
}

function mapContactMetrics(
  rows: ContactMetricsResult[],
  clientsMap: Map<string, LinkedClient[]>,
  membershipsMap: Map<string, ContactMembership[]>
): ContactsSettingsListItem[] {
  return rows.map(row => ({
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    avatarUrl: row.avatarUrl,
    createdBy: row.createdBy,
    userId: row.userId,
    userHasPhoto: Boolean(row.userHasPhoto),
    signInRole: row.signInRole ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    jobTitle: row.jobTitle,
    linkedinUrl: row.linkedinUrl,
    companyId: row.companyId,
    companyName: row.companyName,
    companies: (membershipsMap.get(row.id) ?? []).map(membership => ({
      id: membership.companyId,
      name: membership.companyName,
      isClient: Boolean(membership.clientCompanyId),
    })),
    metrics: {
      totalClients: Number(row.totalClients ?? 0),
      clients: clientsMap.get(row.id) ?? [],
    },
  }))
}

async function resolveCount(conditions: SQL[]) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(conditions.length ? and(...conditions) : undefined)

  return Number(result[0]?.count ?? 0)
}

function buildPageInfo(
  direction: 'forward' | 'backward',
  cursorPayload: SortCursorPayload | null,
  items: ContactsSettingsListItem[],
  hasExtraRecord: boolean,
  sortField: string,
  sortDirection: SortDirection,
  descriptor: ContactSortDescriptor
): PageInfo {
  const firstItem = items[0] ?? null
  const lastItem = items[items.length - 1] ?? null

  const hasPreviousPage =
    direction === 'forward' ? Boolean(cursorPayload) : hasExtraRecord
  const hasNextPage =
    direction === 'forward' ? hasExtraRecord : Boolean(cursorPayload)

  return {
    hasPreviousPage,
    hasNextPage,
    startCursor: firstItem
      ? encodeSortCursor({
          sortField,
          sortDirection,
          value: descriptor.encode(firstItem),
          id: firstItem.id,
        })
      : null,
    endCursor: lastItem
      ? encodeSortCursor({
          sortField,
          sortDirection,
          value: descriptor.encode(lastItem),
          id: lastItem.id,
        })
      : null,
  }
}

export async function listContactsForSettings(
  user: AppUser,
  input: ListContactsForSettingsInput = {}
): Promise<ContactsSettingsResult> {
  assertCrmAccess(user)

  const direction = resolveContactDirection(input.direction)
  const limit = resolvePaginationLimit(input.limit)
  const normalizedStatus = normalizeStatus(input.status)
  const searchQuery = input.search?.trim() ?? ''
  const seesAccess = canSeePortalAccess(user.role)
  const sort = input.sort ?? DEFAULT_CONTACTS_SORT
  const descriptor = CONTACT_SORT_DESCRIPTORS[sort.field]

  const statusCondition = buildStatusCondition(normalizedStatus)
  const baseConditions = buildBaseConditions(
    normalizedStatus,
    searchQuery,
    input.companyId,
    // Sign-ins are admin-only information.
    seesAccess ? input.signIn : null,
    // Without portal access to go on, a client filter means "at the client".
    seesAccess ? 'portal' : 'member'
  )
  const useOffset = typeof input.offset === 'number' && input.offset >= 0

  let normalizedRows: ContactMetricsResult[]
  let cursorHasExtraRecord = false
  let cursorPayloadForPageInfo: SortCursorPayload | null = null

  if (useOffset) {
    const baseWhere = and(...baseConditions)
    const ordering =
      sort.direction === 'asc'
        ? [descriptor.orderAsc, asc(contacts.id)]
        : [descriptor.orderDesc, sql`${contacts.id} DESC`]
    normalizedRows = await queryContactRows(baseWhere, ordering, limit, {
      offset: input.offset!,
    })
  } else {
    // Field-tagged cursor: payloads minted under a different sort are
    // rejected and we serve page one (R5 backstop for stale deep links).
    cursorPayloadForPageInfo = decodeSortCursor(
      input.cursor,
      sort.field,
      sort.direction
    )

    // Effective ordering combines the sort direction with the pagination
    // direction (backward pages scan the reversed order, then re-reverse).
    const effectiveAsc =
      (sort.direction === 'asc') === (direction === 'forward')
    const cursorCondition = cursorPayloadForPageInfo
      ? sql`(${descriptor.compare(effectiveAsc ? 'gt' : 'lt', cursorPayloadForPageInfo.value ?? '')} OR (${descriptor.equals(cursorPayloadForPageInfo.value ?? '')} AND ${effectiveAsc ? sql`${contacts.id} > ${cursorPayloadForPageInfo.id}` : sql`${contacts.id} < ${cursorPayloadForPageInfo.id}`}))`
      : null

    const whereClause = cursorCondition
      ? and(...baseConditions, cursorCondition)
      : and(...baseConditions)

    const ordering = effectiveAsc
      ? [descriptor.orderAsc, asc(contacts.id)]
      : [descriptor.orderDesc, sql`${contacts.id} DESC`]

    const rows = await queryContactRows(whereClause, ordering, limit)

    cursorHasExtraRecord = rows.length > limit
    const slicedRows = cursorHasExtraRecord ? rows.slice(0, limit) : rows
    normalizedRows =
      direction === 'backward' ? [...slicedRows].reverse() : slicedRows
  }

  // Fetch client details for all contacts in parallel with the counts
  const contactIds = normalizedRows.map(row => row.id)
  const [clientsMap, membershipsMap, totalCount, unfilteredTotalCount] =
    await Promise.all([
      fetchClientDetails(contactIds),
      listContactMemberships(contactIds),
      resolveCount(baseConditions),
      resolveCount([statusCondition]),
    ])

  // Sign-ins and portal access are for people who manage clients only.
  const mappedItems = mapContactMetrics(
    normalizedRows,
    clientsMap,
    membershipsMap
  ).map(item =>
    seesAccess
      ? item
      : {
          ...item,
          signInRole: null,
          metrics: { totalClients: 0, clients: [] },
        }
  )

  const pageInfo: PageInfo = useOffset
    ? {
        hasPreviousPage: input.offset! > 0,
        hasNextPage: input.offset! + limit < totalCount,
        startCursor: null,
        endCursor: null,
      }
    : buildPageInfo(
        direction,
        cursorPayloadForPageInfo,
        mappedItems,
        cursorHasExtraRecord,
        sort.field,
        sort.direction,
        descriptor
      )

  return {
    items: mappedItems,
    totalCount,
    unfilteredTotalCount,
    pageInfo,
  }
}
