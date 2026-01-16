'use server'

import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects } from '@/lib/db/schema'
import { CONVEX_FLAGS } from '@/lib/feature-flags'
import { type PageInfo } from '@/lib/pagination/cursor'

import {
  ACTIVE_STATUS,
  clientFields,
  clientGroupByColumns,
  type SelectClient,
} from '../selectors'
import { buildMembersByClient } from './members'
import { listClientUsers } from './users'
import {
  buildClientCursorCondition,
  buildSearchCondition,
  buildStatusCondition,
  decodeClientCursor,
  encodeClientCursor,
  resolveClientDirection,
  resolvePaginationLimit,
  type StatusFilter,
} from './pagination'
import type {
  ClientsSettingsListItem,
  ClientsSettingsResult,
  ListClientsForSettingsInput,
} from './types'

type ClientMetricsResult = SelectClient & {
  totalProjects: number | string | null
  activeProjects: number | string | null
}

function normalizeStatus(status?: string | null): StatusFilter {
  return status === 'archived' ? 'archived' : 'active'
}

function buildBaseConditions(
  status: StatusFilter,
  searchQuery: string,
): SQL[] {
  const conditions: SQL[] = [buildStatusCondition(status)]

  const searchCondition = buildSearchCondition(searchQuery)
  if (searchCondition) {
    conditions.push(searchCondition)
  }

  return conditions
}

async function queryClientRows(
  whereClause: SQL | undefined,
  ordering: SQL[],
  limit: number,
) {
  return db
    .select({
      ...clientFields,
      totalProjects: sql<number>`count(${projects.id})`,
      activeProjects: sql<number>`
        coalesce(sum(
          case
            when ${projects.deletedAt} is null
              and coalesce(lower(${projects.status}::text), '') = lower(${ACTIVE_STATUS})
            then 1
            else 0
          end
        ), 0)
      `,
    })
    .from(clients)
    .leftJoin(projects, eq(projects.clientId, clients.id))
    .where(whereClause)
    .groupBy(...clientGroupByColumns)
    .orderBy(...ordering)
    .limit(limit + 1) as Promise<ClientMetricsResult[]>
}

function mapClientMetrics(rows: ClientMetricsResult[]): ClientsSettingsListItem[] {
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    billingType: row.billingType,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    metrics: {
      totalProjects: Number(row.totalProjects ?? 0),
      activeProjects: Number(row.activeProjects ?? 0),
    },
  }))
}

async function resolveTotalCount(conditions: SQL[]) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(clients)
    .where(conditions.length ? and(...conditions) : undefined)

  return Number(result[0]?.count ?? 0)
}

function buildPageInfo(
  direction: 'forward' | 'backward',
  cursorPayload: ReturnType<typeof decodeClientCursor>,
  items: ClientsSettingsListItem[],
  hasExtraRecord: boolean,
): PageInfo {
  const firstItem = items[0] ?? null
  const lastItem = items[items.length - 1] ?? null

  const hasPreviousPage =
    direction === 'forward'
      ? Boolean(cursorPayload)
      : hasExtraRecord
  const hasNextPage =
    direction === 'forward'
      ? hasExtraRecord
      : Boolean(cursorPayload)

  return {
    hasPreviousPage,
    hasNextPage,
    startCursor: encodeClientCursor(firstItem ? { name: firstItem.name ?? '', id: firstItem.id } : null),
    endCursor: encodeClientCursor(lastItem ? { name: lastItem.name ?? '', id: lastItem.id } : null),
  }
}

/**
 * Fetch clients for settings from Convex
 *
 * Note: This is a simplified implementation that doesn't support pagination
 * or cursor-based navigation. It fetches all matching clients at once.
 * This is acceptable for the settings/archive pages which typically have
 * a small number of clients.
 */
async function listClientsForSettingsFromConvex(
  _user: AppUser,
  status: StatusFilter,
  searchQuery: string,
): Promise<ClientsSettingsResult> {
  // Lazy import to avoid loading Convex when not needed
  const {
    fetchClientsWithMetricsFromConvex,
    fetchArchivedClientsWithMetricsFromConvex,
  } = await import('@/lib/data/clients/convex')

  // Fetch from the appropriate Convex query based on status
  const convexClients = status === 'archived'
    ? await fetchArchivedClientsWithMetricsFromConvex()
    : await fetchClientsWithMetricsFromConvex()

  // Filter by search query if provided
  let filteredClients = convexClients
  if (searchQuery) {
    const lowerSearch = searchQuery.toLowerCase()
    filteredClients = convexClients.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerSearch) ||
        c.slug?.toLowerCase().includes(lowerSearch)
    )
  }

  // Map to settings list item format
  const items: ClientsSettingsListItem[] = filteredClients.map((client) => ({
    id: client.id,
    name: client.name,
    slug: client.slug,
    notes: client.notes,
    billingType: client.billingType,
    createdBy: null, // Not available from Convex query yet
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    deletedAt: client.deletedAt,
    metrics: {
      totalProjects: client.projectCount,
      activeProjects: client.activeProjectCount,
    },
  }))

  const clientIds = items.map((item) => item.id)

  // Fetch members and users from Supabase (these aren't migrated to Convex yet)
  const [membersByClient, clientUsers] = await Promise.all([
    buildMembersByClient(clientIds),
    listClientUsers(),
  ])

  return {
    items,
    membersByClient,
    clientUsers,
    totalCount: items.length,
    pageInfo: {
      hasPreviousPage: false,
      hasNextPage: false,
      startCursor: encodeClientCursor(items[0] ? { name: items[0].name ?? '', id: items[0].id } : null),
      endCursor: encodeClientCursor(items[items.length - 1] ? { name: items[items.length - 1].name ?? '', id: items[items.length - 1].id } : null),
    },
  }
}

export async function listClientsForSettings(
  user: AppUser,
  input: ListClientsForSettingsInput = {},
): Promise<ClientsSettingsResult> {
  assertAdmin(user)

  const normalizedStatus = normalizeStatus(input.status)
  const searchQuery = input.search?.trim() ?? ''

  // Use Convex if enabled
  if (CONVEX_FLAGS.CLIENTS) {
    try {
      return await listClientsForSettingsFromConvex(user, normalizedStatus, searchQuery)
    } catch (error) {
      console.error('Failed to fetch clients from Convex for settings', error)
      // Fall through to Supabase on error during migration
    }
  }

  // Supabase (default)
  const direction = resolveClientDirection(input.direction)
  const limit = resolvePaginationLimit(input.limit)

  const baseConditions = buildBaseConditions(normalizedStatus, searchQuery)

  const cursorPayload = decodeClientCursor(input.cursor)
  const cursorCondition = buildClientCursorCondition(direction, cursorPayload)

  const whereClause =
    cursorCondition ? and(...baseConditions, cursorCondition) : and(...baseConditions)

  const ordering =
    direction === 'forward'
      ? [asc(clients.name), asc(clients.id)]
      : [desc(clients.name), desc(clients.id)]

  const rows = await queryClientRows(whereClause, ordering, limit)

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  const mappedItems = mapClientMetrics(normalizedRows)

  const totalCount = await resolveTotalCount(baseConditions)
  const pageInfo = buildPageInfo(direction, cursorPayload, mappedItems, hasExtraRecord)

  const clientIds = mappedItems.map(item => item.id)

  const [membersByClient, clientUsers] = await Promise.all([
    buildMembersByClient(clientIds),
    listClientUsers(),
  ])

  return {
    items: mappedItems,
    membersByClient,
    clientUsers,
    totalCount,
    pageInfo,
  }
}

