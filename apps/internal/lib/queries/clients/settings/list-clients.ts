import 'server-only'

import { and, asc, eq, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects } from '@/lib/db/schema'
import { fetchLatestClosersByClient } from '@/lib/queries/clients/commission-terms'
import type { ClientCloser } from '@/lib/settings/clients/closers'
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
  offset: number,
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
    .limit(limit)
    .offset(offset) as Promise<ClientMetricsResult[]>
}

function mapClientMetrics(
  rows: ClientMetricsResult[],
  closersByClient: Map<string, ClientCloser[]>
): ClientsSettingsListItem[] {
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    notes: row.notes,
    billingType: row.billingType,
    state: row.state,
    originationContactId: row.originationContactId,
    originationUserId: row.originationUserId,
    companyId: row.companyId,
    label: row.label,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    closers: closersByClient.get(row.id) ?? [],
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


export async function listClientsForSettings(
  user: AppUser,
  input: ListClientsForSettingsInput = {},
): Promise<ClientsSettingsResult> {
  assertAdmin(user)

  const normalizedStatus = normalizeStatus(input.status)
  const searchQuery = input.search?.trim() ?? ''

  const limit = resolvePaginationLimit(input.limit)
  const offset = Math.max(0, Math.floor(input.offset ?? 0))
  const sort = input.sort ?? DEFAULT_CLIENTS_SORT
  const descriptor = CLIENT_SORT_DESCRIPTORS[sort.field]

  const statusCondition = buildStatusCondition(normalizedStatus)
  const baseConditions = buildBaseConditions(
    normalizedStatus,
    searchQuery,
    input.billing,
  )

  // Offset paging (page numbers + total, like every other list). The id
  // tiebreaker keeps page boundaries stable when sort values collide.
  const ordering =
    sort.direction === 'asc'
      ? [descriptor.orderAsc, asc(clients.id)]
      : [descriptor.orderDesc, sql`${clients.id} DESC`]

  const [rows, totalCount, unfilteredTotalCount] = await Promise.all([
    queryClientRows(and(...baseConditions), ordering, limit, offset),
    resolveCount(baseConditions),
    resolveCount([statusCondition]),
  ])

  const closersByClient = await fetchLatestClosersByClient(
    rows.map(row => row.id)
  )
  const mappedItems = mapClientMetrics(rows, closersByClient)

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
  }
}
