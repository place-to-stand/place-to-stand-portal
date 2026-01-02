'use server'

import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, contacts, contactClients } from '@/lib/db/schema'
import { type PageInfo } from '@/lib/pagination/cursor'

import { contactFields, contactGroupByColumns, type SelectContact } from '../selectors'
import {
  buildContactCursorCondition,
  buildSearchCondition,
  buildStatusCondition,
  decodeContactCursor,
  encodeContactCursor,
  normalizeStatus,
  resolveContactDirection,
  resolvePaginationLimit,
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
  limit: number
) {
  return db
    .select({
      ...contactFields,
      totalClients: sql<number>`count(${contactClients.clientId})`,
    })
    .from(contacts)
    .leftJoin(contactClients, eq(contactClients.contactId, contacts.id))
    .where(whereClause)
    .groupBy(...contactGroupByColumns)
    .orderBy(...ordering)
    .limit(limit + 1) as Promise<ContactMetricsResult[]>
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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    metrics: {
      totalClients: Number(row.totalClients ?? 0),
      clients: clientsMap.get(row.id) ?? [],
    },
  }))
}

async function resolveTotalCount(conditions: SQL[]) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(conditions.length ? and(...conditions) : undefined)

  return Number(result[0]?.count ?? 0)
}

function buildPageInfo(
  direction: 'forward' | 'backward',
  cursorPayload: ReturnType<typeof decodeContactCursor>,
  items: ContactsSettingsListItem[],
  hasExtraRecord: boolean
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
    startCursor: encodeContactCursor(
      firstItem ? { email: firstItem.email ?? '', id: firstItem.id } : null
    ),
    endCursor: encodeContactCursor(
      lastItem ? { email: lastItem.email ?? '', id: lastItem.id } : null
    ),
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

  const baseConditions = buildBaseConditions(normalizedStatus, searchQuery)

  const cursorPayload = decodeContactCursor(input.cursor)
  const cursorCondition = buildContactCursorCondition(direction, cursorPayload)

  const whereClause = cursorCondition
    ? and(...baseConditions, cursorCondition)
    : and(...baseConditions)

  const ordering =
    direction === 'forward'
      ? [asc(contacts.email), asc(contacts.id)]
      : [desc(contacts.email), desc(contacts.id)]

  const rows = await queryContactRows(whereClause, ordering, limit)

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  // Fetch client details for all contacts in parallel with total count
  const contactIds = normalizedRows.map(row => row.id)
  const [clientsMap, totalCount] = await Promise.all([
    fetchClientDetails(contactIds),
    resolveTotalCount(baseConditions),
  ])

  const mappedItems = mapContactMetrics(normalizedRows, clientsMap)
  const pageInfo = buildPageInfo(direction, cursorPayload, mappedItems, hasExtraRecord)

  return {
    items: mappedItems,
    totalCount,
    pageInfo,
  }
}
