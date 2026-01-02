import 'server-only'

import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects, timeLogs, users } from '@/lib/db/schema'
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  resolveDirection,
  type CursorDirection,
  type PageInfo,
} from '@/lib/pagination/cursor'

// Selection objects
const timeLogSelection = {
  id: timeLogs.id,
  projectId: timeLogs.projectId,
  userId: timeLogs.userId,
  hours: timeLogs.hours,
  loggedOn: timeLogs.loggedOn,
  note: timeLogs.note,
  createdAt: timeLogs.createdAt,
  updatedAt: timeLogs.updatedAt,
  deletedAt: timeLogs.deletedAt,
}

const userSelection = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  deletedAt: users.deletedAt,
}

const projectSelection = {
  id: projects.id,
  name: projects.name,
  deletedAt: projects.deletedAt,
}

const clientSelection = {
  id: clients.id,
  name: clients.name,
  deletedAt: clients.deletedAt,
}

// Type definitions
export type TimeLogForAdmin = {
  id: string
  projectId: string
  userId: string
  hours: string
  loggedOn: string
  note: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  user: {
    id: string
    email: string
    fullName: string | null
    deletedAt: string | null
  } | null
  project: {
    id: string
    name: string
    deletedAt: string | null
  } | null
  client: {
    id: string
    name: string
    deletedAt: string | null
  } | null
}

export type ListTimeLogsForAdminInput = {
  sortBy?: 'user' | 'project' | 'date' | 'hours'
  sortDir?: 'asc' | 'desc'
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
}

export type TimeLogsAdminResult = {
  items: TimeLogForAdmin[]
  totalCount: number
  pageInfo: PageInfo
}

// Helper to get sort expression based on sortBy field
function getSortExpression(sortBy: string): SQL {
  switch (sortBy) {
    case 'user':
      return sql<string>`coalesce(nullif(${users.fullName}, ''), ${users.email}, '')`
    case 'project':
      return sql`${projects.name}`
    case 'hours':
      return sql`${timeLogs.hours}`
    case 'date':
    default:
      return sql`${timeLogs.loggedOn}`
  }
}

// Helper to extract sort value from item for cursor encoding
function getSortValue(
  item: TimeLogForAdmin,
  sortBy: string,
): string | number {
  switch (sortBy) {
    case 'user':
      return item.user?.fullName ?? item.user?.email ?? ''
    case 'project':
      return item.project?.name ?? ''
    case 'hours':
      return item.hours
    case 'date':
    default:
      return item.loggedOn
  }
}

// Build cursor condition for pagination
function buildTimeLogCursorCondition(
  direction: CursorDirection,
  sortBy: string,
  sortDir: string,
  cursor: { sortValue?: string | number | null; id?: string | null } | null,
  sortExpression: SQL,
): SQL | null {
  if (!cursor || !cursor.id) {
    return null
  }

  const sortValue = cursor.sortValue
  const idValue = cursor.id

  if (!idValue) {
    return null
  }

  // For forward pagination with DESC sort
  if (direction === 'forward' && sortDir === 'desc') {
    return sql`${sortExpression} < ${sortValue} OR (${sortExpression} = ${sortValue} AND ${timeLogs.id} < ${idValue})`
  }

  // For forward pagination with ASC sort
  if (direction === 'forward' && sortDir === 'asc') {
    return sql`${sortExpression} > ${sortValue} OR (${sortExpression} = ${sortValue} AND ${timeLogs.id} > ${idValue})`
  }

  // For backward pagination with DESC sort
  if (direction === 'backward' && sortDir === 'desc') {
    return sql`${sortExpression} > ${sortValue} OR (${sortExpression} = ${sortValue} AND ${timeLogs.id} > ${idValue})`
  }

  // For backward pagination with ASC sort
  return sql`${sortExpression} < ${sortValue} OR (${sortExpression} = ${sortValue} AND ${timeLogs.id} < ${idValue})`
}

export async function listTimeLogsForAdmin(
  user: AppUser,
  input: ListTimeLogsForAdminInput = {},
): Promise<TimeLogsAdminResult> {
  assertAdmin(user)

  const direction = resolveDirection(input.direction)
  const limit = clampLimit(input.limit, { defaultLimit: 20, maxLimit: 100 })
  const sortBy = input.sortBy ?? 'date'
  const sortDir = input.sortDir ?? 'desc'

  // Base conditions - only show active time logs (not deleted)
  const baseConditions: SQL[] = [isNull(timeLogs.deletedAt)]

  // Get sort expression
  const sortExpression = getSortExpression(sortBy)

  // Decode cursor
  const cursorPayload = decodeCursor<{
    sortValue?: string | number
    id?: string
  }>(input.cursor)

  // Build cursor condition
  const cursorCondition = buildTimeLogCursorCondition(
    direction,
    sortBy,
    sortDir,
    cursorPayload,
    sortExpression,
  )

  const paginatedConditions = cursorCondition
    ? [...baseConditions, cursorCondition]
    : baseConditions

  const whereClause =
    paginatedConditions.length > 0 ? and(...paginatedConditions) : undefined

  // Build ordering
  const primaryOrder = sortDir === 'asc' ? asc(sortExpression) : desc(sortExpression)
  const secondaryOrder = sortDir === 'asc' ? asc(timeLogs.id) : desc(timeLogs.id)
  const ordering = [primaryOrder, secondaryOrder]

  // Execute paginated query
  const rows = await db
    .select({
      log: timeLogSelection,
      user: userSelection,
      project: projectSelection,
      client: clientSelection,
    })
    .from(timeLogs)
    .leftJoin(users, eq(timeLogs.userId, users.id))
    .leftJoin(projects, eq(timeLogs.projectId, projects.id))
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(whereClause)
    .orderBy(...ordering)
    .limit(limit + 1)

  const hasExtraRecord = rows.length > limit
  const slicedRows = hasExtraRecord ? rows.slice(0, limit) : rows
  const normalizedRows =
    direction === 'backward' ? [...slicedRows].reverse() : slicedRows

  // Map to result type
  const mappedItems: TimeLogForAdmin[] = normalizedRows.map(row => ({
    id: row.log.id,
    projectId: row.log.projectId,
    userId: row.log.userId,
    hours: row.log.hours,
    loggedOn: row.log.loggedOn,
    note: row.log.note,
    createdAt: row.log.createdAt,
    updatedAt: row.log.updatedAt,
    deletedAt: row.log.deletedAt,
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          fullName: row.user.fullName,
          deletedAt: row.user.deletedAt,
        }
      : null,
    project: row.project
      ? {
          id: row.project.id,
          name: row.project.name,
          deletedAt: row.project.deletedAt,
        }
      : null,
    client: row.client
      ? {
          id: row.client.id,
          name: row.client.name,
          deletedAt: row.client.deletedAt,
        }
      : null,
  }))

  // Get total count
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(timeLogs)
    .where(baseConditions.length ? and(...baseConditions) : undefined)

  const totalCount = Number(totalResult[0]?.count ?? 0)

  // Build page info
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
      ? encodeCursor({
          sortValue: getSortValue(firstItem, sortBy),
          id: firstItem.id,
        })
      : null,
    endCursor: lastItem
      ? encodeCursor({
          sortValue: getSortValue(lastItem, sortBy),
          id: lastItem.id,
        })
      : null,
  }

  return {
    items: mappedItems,
    totalCount,
    pageInfo,
  }
}
