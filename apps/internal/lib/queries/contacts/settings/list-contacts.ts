'use server'

import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, contacts, contactClients } from '@/lib/db/schema'
import { type PageInfo } from '@/lib/pagination/cursor'
import {
  decodeSortCursor,
  encodeSortCursor,
  type SortCursorPayload,
  type SortDirection,
} from '@/lib/pagination/sort'
import { DEFAULT_CONTACTS_SORT } from '@/lib/settings/contacts/filters'

import { contactFields, type SelectContact } from '../selectors'
import {
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

type ContactMetricsResult = SelectContact & {
  totalClients: number | string | null
}

function buildBaseConditions(status: StatusFilter, searchQuery: string): SQL[] {
  const conditions: SQL[] = [buildStatusCondition(status)]

  const searchCondition = buildSearchCondition(searchQuery)
  if (searchCondition) {
    conditions.push(searchCondition)
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
  // clients (matching the Linked Clients cell) and is also what the
  // `clients` sort descriptor orders by.
  const query = db
    .select({
      ...contactFields,
      totalClients: linkedClientsCountSql,
    })
    .from(contacts)
    .where(whereClause)
    .orderBy(...ordering)

  if (typeof opts?.offset === 'number') {
    return query.limit(limit).offset(opts.offset) as Promise<ContactMetricsResult[]>
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
      contactId: contactClients.contactId,
      clientId: clients.id,
      clientName: clients.name,
      clientSlug: clients.slug,
    })
    .from(contactClients)
    .innerJoin(clients, eq(contactClients.clientId, clients.id))
    .where(
      and(
        inArray(contactClients.contactId, contactIds),
        sql`${clients.deletedAt} IS NULL`
      )
    )
    .orderBy(asc(clients.name))

  const result = new Map<string, LinkedClient[]>()
  for (const row of rows) {
    const existing = result.get(row.contactId) ?? []
    existing.push({
      id: row.clientId,
      name: row.clientName,
      slug: row.clientSlug ?? row.clientId,
    })
    result.set(row.contactId, existing)
  }

  return result
}

function mapContactMetrics(
  rows: ContactMetricsResult[],
  clientsMap: Map<string, LinkedClient[]>
): ContactsSettingsListItem[] {
  return rows.map(row => ({
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    createdBy: row.createdBy,
    userId: row.userId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
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
  assertAdmin(user)

  const direction = resolveContactDirection(input.direction)
  const limit = resolvePaginationLimit(input.limit)
  const normalizedStatus = normalizeStatus(input.status)
  const searchQuery = input.search?.trim() ?? ''
  const sort = input.sort ?? DEFAULT_CONTACTS_SORT
  const descriptor = CONTACT_SORT_DESCRIPTORS[sort.field]

  const statusCondition = buildStatusCondition(normalizedStatus)
  const baseConditions = buildBaseConditions(normalizedStatus, searchQuery)
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
  const [clientsMap, totalCount, unfilteredTotalCount] = await Promise.all([
    fetchClientDetails(contactIds),
    resolveCount(baseConditions),
    resolveCount([statusCondition]),
  ])

  const mappedItems = mapContactMetrics(normalizedRows, clientsMap)

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
