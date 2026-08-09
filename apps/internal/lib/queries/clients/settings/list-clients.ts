'use server'

import { and, asc, eq, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects } from '@/lib/db/schema'
import { type PageInfo } from '@/lib/pagination/cursor'
import {
  decodeSortCursor,
  encodeSortCursor,
  type SortCursorPayload,
} from '@/lib/pagination/sort'
import { DEFAULT_CLIENTS_SORT } from '@/lib/settings/clients/filters'

import {
  ACTIVE_STATUS,
  clientFields,
  clientGroupByColumns,
  type SelectClient,
} from '../selectors'
import { buildMembersByClient } from './members'
import { listClientUsers } from './users'
import {
  buildBillingCondition,
  buildSearchCondition,
  buildStatusCondition,
  CLIENT_SORT_DESCRIPTORS,
  normalizeStatus,
  resolveClientDirection,
  resolvePaginationLimit,
  type ClientSortDescriptor,
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

function buildBaseConditions(
  status: StatusFilter,
  searchQuery: string,
  billing: ListClientsForSettingsInput['billing'],
): SQL[] {
  const conditions: SQL[] = [buildStatusCondition(status)]

  const billingCondition = buildBillingCondition(billing)
  if (billingCondition) {
    conditions.push(billingCondition)
  }

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
    website: row.website,
    state: row.state,
    originationContactId: row.originationContactId,
    originationUserId: row.originationUserId,
    closerUserId: row.closerUserId,
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

async function resolveCount(conditions: SQL[]) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(clients)
    .where(conditions.length ? and(...conditions) : undefined)

  return Number(result[0]?.count ?? 0)
}

function buildPageInfo(
  direction: 'forward' | 'backward',
  cursorPayload: SortCursorPayload | null,
  items: ClientsSettingsListItem[],
  hasExtraRecord: boolean,
  sortField: string,
  descriptor: ClientSortDescriptor,
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
    startCursor: firstItem
      ? encodeSortCursor({
          sortField,
          value: descriptor.encode(firstItem),
          id: firstItem.id,
        })
      : null,
    endCursor: lastItem
      ? encodeSortCursor({
          sortField,
          value: descriptor.encode(lastItem),
          id: lastItem.id,
        })
      : null,
  }
}

export async function listClientsForSettings(
  user: AppUser,
  input: ListClientsForSettingsInput = {},
): Promise<ClientsSettingsResult> {
  assertAdmin(user)

  const normalizedStatus = normalizeStatus(input.status)
  const searchQuery = input.search?.trim() ?? ''

  const direction = resolveClientDirection(input.direction)
  const limit = resolvePaginationLimit(input.limit)
  const sort = input.sort ?? DEFAULT_CLIENTS_SORT
  const descriptor = CLIENT_SORT_DESCRIPTORS[sort.field]

  const statusCondition = buildStatusCondition(normalizedStatus)
  const baseConditions = buildBaseConditions(
    normalizedStatus,
    searchQuery,
    input.billing,
  )

  // Field-tagged cursor: payloads minted under a different sort are
  // rejected and we serve page one (R5 backstop for stale deep links).
  const cursorPayload = decodeSortCursor(input.cursor, sort.field)

  // Effective ordering combines the sort direction with the pagination
  // direction (backward pages scan the reversed order, then re-reverse).
  const effectiveAsc = (sort.direction === 'asc') === (direction === 'forward')
  const cursorCondition = cursorPayload
    ? sql`(${descriptor.compare(effectiveAsc ? 'gt' : 'lt', cursorPayload.value ?? '')} OR (${descriptor.equals(cursorPayload.value ?? '')} AND ${effectiveAsc ? sql`${clients.id} > ${cursorPayload.id}` : sql`${clients.id} < ${cursorPayload.id}`}))`
    : null

  const whereClause =
    cursorCondition ? and(...baseConditions, cursorCondition) : and(...baseConditions)

  const ordering = effectiveAsc
    ? [descriptor.orderAsc, asc(clients.id)]
    : [descriptor.orderDesc, sql`${clients.id} DESC`]

  const rows = await queryClientRows(whereClause, ordering, limit)

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  const mappedItems = mapClientMetrics(normalizedRows)

  const [totalCount, unfilteredTotalCount] = await Promise.all([
    resolveCount(baseConditions),
    resolveCount([statusCondition]),
  ])
  const pageInfo = buildPageInfo(
    direction,
    cursorPayload,
    mappedItems,
    hasExtraRecord,
    sort.field,
    descriptor,
  )

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
    unfilteredTotalCount,
    pageInfo,
  }
}
