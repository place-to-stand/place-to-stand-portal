import 'server-only'

import { and, asc, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import type { UserAccessFilter, UserSortField } from '@/lib/settings/users/filters'
import { DEFAULT_USERS_SORT } from '@/lib/settings/users/filters'
import type { UserRoleValue } from '@/lib/types'
import {
  clampLimit,
  createSearchPattern,
  resolveDirection,
  type CursorDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'
import {
  decodeSortCursor,
  encodeSortCursor,
  type ParsedSort,
} from '@/lib/pagination/sort'

import { userSortExpression, type SelectUser } from './fields'
import {
  buildAssignmentsForUsers,
  type UsersSettingsAssignments,
} from './assignments'

export type UsersSettingsListItem = SelectUser

export type ListUsersForSettingsInput = {
  status?: 'active' | 'archived'
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
  role?: UserRoleValue
  access?: UserAccessFilter
  search?: string
  sort?: ParsedSort<UserSortField>
}

export type UsersSettingsResult = {
  items: UsersSettingsListItem[]
  assignments: UsersSettingsAssignments
  /** Rows matching the active filters/search (drives `Showing N of M`). */
  totalCount: number
  /** Rows on the tab regardless of filters/search (the `M`). */
  unfilteredTotalCount: number
  pageInfo: PageInfo
}

/**
 * Per-sort descriptor (PRD 004 §03, R5): order expression + cursor value
 * encoding + comparison predicates per field. Both fields are non-nullable
 * so no null partition applies; a nullable field added here must declare
 * NULLS LAST ordering and null-aware conditions.
 */
type UserSortDescriptor = {
  encode: (row: UsersSettingsListItem) => string
  compare: (op: 'gt' | 'lt', value: string) => SQL
  equals: (value: string) => SQL
  orderAsc: SQL
  orderDesc: SQL
}

const USER_SORT_DESCRIPTORS: Record<UserSortField, UserSortDescriptor> = {
  name: {
    encode: row => row.fullName ?? row.email ?? '',
    compare: (op, value) =>
      op === 'gt'
        ? sql`${userSortExpression} > ${value}`
        : sql`${userSortExpression} < ${value}`,
    equals: value => sql`${userSortExpression} = ${value}`,
    orderAsc: sql`${userSortExpression} ASC`,
    orderDesc: sql`${userSortExpression} DESC`,
  },
  created: {
    encode: row => String(row.createdAt),
    compare: (op, value) =>
      op === 'gt'
        ? sql`${users.createdAt} > ${value}::timestamptz`
        : sql`${users.createdAt} < ${value}::timestamptz`,
    equals: value => sql`${users.createdAt} = ${value}::timestamptz`,
    orderAsc: sql`${users.createdAt} ASC`,
    orderDesc: sql`${users.createdAt} DESC`,
  },
}

export async function listUsersForSettings(
  user: AppUser,
  input: ListUsersForSettingsInput = {},
): Promise<UsersSettingsResult> {
  assertAdmin(user)

  const direction = resolveDirection(input.direction)
  const limit = clampLimit(input.limit, { defaultLimit: 20, maxLimit: 100 })
  const normalizedStatus = input.status === 'archived' ? 'archived' : 'active'
  const sort = input.sort ?? DEFAULT_USERS_SORT
  const descriptor = USER_SORT_DESCRIPTORS[sort.field]

  const statusCondition =
    normalizedStatus === 'active'
      ? isNull(users.deletedAt)
      : sql`${users.deletedAt} IS NOT NULL`

  const baseConditions: SQL[] = [statusCondition]

  // Role/access/search filters live in baseConditions so totalCount follows.
  if (input.role) {
    baseConditions.push(eq(users.role, input.role))
  }
  if (input.access === 'enabled') {
    baseConditions.push(isNull(users.disabledAt))
  }
  if (input.access === 'disabled') {
    baseConditions.push(isNotNull(users.disabledAt))
  }
  const searchQuery = input.search?.trim() ?? ''
  if (searchQuery) {
    const pattern = createSearchPattern(searchQuery)
    baseConditions.push(
      sql`(${userSortExpression} ILIKE ${pattern} OR ${users.email} ILIKE ${pattern})`,
    )
  }

  // Field-tagged cursor: payloads minted under a different sort are
  // rejected and we serve page one (R5 backstop for stale deep links).
  const cursorPayload = decodeSortCursor(input.cursor, sort.field)

  // Effective ordering combines the sort direction with the pagination
  // direction (backward pages scan the reversed order, then re-reverse).
  const effectiveAsc = (sort.direction === 'asc') === (direction === 'forward')
  const cursorCondition = cursorPayload
    ? sql`(${descriptor.compare(effectiveAsc ? 'gt' : 'lt', cursorPayload.value ?? '')} OR (${descriptor.equals(cursorPayload.value ?? '')} AND ${effectiveAsc ? sql`${users.id} > ${cursorPayload.id}` : sql`${users.id} < ${cursorPayload.id}`}))`
    : null

  const paginatedConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions

  const whereClause =
    paginatedConditions.length > 0 ? and(...paginatedConditions) : undefined

  const ordering = effectiveAsc
    ? [descriptor.orderAsc, asc(users.id)]
    : [descriptor.orderDesc, sql`${users.id} DESC`]

  const rows = (await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
      disabledAt: users.disabledAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(...ordering)
    .limit(limit + 1)) as UsersSettingsListItem[]

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  const mappedItems = normalizedRows.map(row => ({
    ...row,
  }))

  const [totalResult, unfilteredTotalResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...baseConditions)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(statusCondition),
  ])

  const totalCount = Number(totalResult[0]?.count ?? 0)
  const unfilteredTotalCount = Number(unfilteredTotalResult[0]?.count ?? 0)
  const firstItem = mappedItems[0] ?? null
  const lastItem = mappedItems[mappedItems.length - 1] ?? null

  const hasPreviousPage =
    direction === 'forward' ? Boolean(cursorPayload) : hasExtraRecord
  const hasNextPage =
    direction === 'forward' ? hasExtraRecord : Boolean(cursorPayload)

  const pageInfo: PageInfo = {
    hasPreviousPage,
    hasNextPage,
    startCursor: firstItem
      ? encodeSortCursor({
          sortField: sort.field,
          value: descriptor.encode(firstItem),
          id: firstItem.id,
        })
      : null,
    endCursor: lastItem
      ? encodeSortCursor({
          sortField: sort.field,
          value: descriptor.encode(lastItem),
          id: lastItem.id,
        })
      : null,
  }

  const userIds = mappedItems.map(item => item.id)
  const assignments = await buildAssignmentsForUsers(userIds)

  return {
    items: mappedItems,
    assignments,
    totalCount,
    unfilteredTotalCount,
    pageInfo,
  }
}
