import 'server-only'

import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  isAdmin,
  listAccessibleClientIds,
  listAccessibleProjectIds,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { hourBlocks, projects, timeLogs } from '@/lib/db/schema'
import type { HoursSnapshot, MonthCursor } from '@/lib/dashboard/types'

const HOURS_PRECISION = 2

export async function fetchHoursSnapshot(
  user: AppUser,
  cursor: MonthCursor
): Promise<HoursSnapshot> {
  const bounds = await resolveSnapshotBounds()
  const normalizedCursor = normalizeMonth(cursor.year, cursor.month)
  const clampedCursor = clampMonthCursor(
    normalizedCursor,
    bounds.min,
    bounds.max
  )
  const { year, month } = clampedCursor
  const { startDate, endDate } = buildMonthDateRange(year, month)

  // My hours: billable (CLIENT project) hours only
  const myHours = await sumHoursWithProjectFilter({
    filters: [
      eq(timeLogs.userId, user.id),
      gte(timeLogs.loggedOn, startDate),
      lte(timeLogs.loggedOn, endDate),
      isNull(timeLogs.deletedAt),
    ],
    projectType: 'CLIENT',
  })

  const scopedProjectIds = await resolveProjectScope(user)
  const baseFilters: SQL<unknown>[] = [
    gte(timeLogs.loggedOn, startDate),
    lte(timeLogs.loggedOn, endDate),
    isNull(timeLogs.deletedAt),
  ]

  if (Array.isArray(scopedProjectIds)) {
    if (!scopedProjectIds.length) {
      return {
        month,
        year,
        myHours,
        companyHours: 0,
        companyHoursPrepaid: 0,
        internalPersonalHours: 0,
        scopeLabel: 'Your accounts',
        minCursor: bounds.min,
        maxCursor: bounds.max,
      }
    }
    baseFilters.push(inArray(timeLogs.projectId, scopedProjectIds))
  }

  // Company hours: billable (CLIENT project) hours only
  const companyHours = await sumHoursWithProjectFilter({
    filters: baseFilters,
    projectType: 'CLIENT',
  })

  // Internal/Personal hours: non-billable project hours
  const internalPersonalHours = await sumHoursWithProjectFilter({
    filters: baseFilters,
    projectType: 'NON_CLIENT',
  })

  const scopedClientIds = await resolveClientScope(user)
  const { startTimestamp, endTimestamp } = buildMonthTimestampRange(year, month)
  const prepaidFilters = [
    gte(hourBlocks.createdAt, startTimestamp),
    sql`${hourBlocks.createdAt} < ${endTimestamp}`,
    isNull(hourBlocks.deletedAt),
  ]

  if (Array.isArray(scopedClientIds)) {
    if (!scopedClientIds.length) {
      return {
        month,
        year,
        myHours,
        companyHours,
        companyHoursPrepaid: 0,
        internalPersonalHours,
        scopeLabel: 'Your accounts',
        minCursor: bounds.min,
        maxCursor: bounds.max,
      }
    }
    prepaidFilters.push(inArray(hourBlocks.clientId, scopedClientIds))
  }

  const companyHoursPrepaid = await sumPrepaidHours({ filters: prepaidFilters })

  return {
    month,
    year,
    myHours,
    companyHours,
    companyHoursPrepaid,
    internalPersonalHours,
    scopeLabel: Array.isArray(scopedProjectIds)
      ? 'Your accounts'
      : 'All projects',
    minCursor: bounds.min,
    maxCursor: bounds.max,
  }
}

async function resolveProjectScope(user: AppUser) {
  if (user.role === 'CLIENT') {
    return await listAccessibleProjectIds(user)
  }

  if (isAdmin(user)) {
    return null
  }

  return null
}

async function resolveClientScope(user: AppUser) {
  if (user.role === 'CLIENT') {
    return await listAccessibleClientIds(user)
  }

  if (isAdmin(user)) {
    return null
  }

  return null
}

async function sumHoursWithProjectFilter({
  filters,
  projectType,
}: {
  filters: SQL<unknown>[]
  projectType: 'CLIENT' | 'NON_CLIENT'
}): Promise<number> {
  const conditions = filters.filter(Boolean)

  if (!conditions.length) {
    return 0
  }

  // Add project type filter by joining with projects table
  const projectTypeCondition =
    projectType === 'CLIENT'
      ? eq(projects.type, 'CLIENT')
      : ne(projects.type, 'CLIENT')

  const [row] = (await db
    .select({
      totalHours: sql<string | null>`COALESCE(SUM(${timeLogs.hours}), '0')`,
    })
    .from(timeLogs)
    .innerJoin(projects, eq(timeLogs.projectId, projects.id))
    .where(and(...conditions, projectTypeCondition, isNull(projects.deletedAt)))) as Array<{
    totalHours: string | null
  }>

  const parsed = Number(row?.totalHours ?? '0')
  const rounded = Number.isFinite(parsed)
    ? Number(parsed.toFixed(HOURS_PRECISION))
    : 0

  return rounded
}

async function sumPrepaidHours({
  filters,
}: {
  filters: SQL<unknown>[]
}): Promise<number> {
  const conditions = filters.filter(Boolean)

  if (!conditions.length) {
    return 0
  }

  const [row] = (await db
    .select({
      totalHours: sql<string | null>`COALESCE(SUM(${hourBlocks.hoursPurchased}), '0')`,
    })
    .from(hourBlocks)
    .where(and(...conditions))) as Array<{ totalHours: string | null }>

  const parsed = Number(row?.totalHours ?? '0')
  const rounded = Number.isFinite(parsed)
    ? Number(parsed.toFixed(HOURS_PRECISION))
    : 0

  return rounded
}

function buildMonthDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

function buildMonthTimestampRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const nextMonth = new Date(Date.UTC(year, month, 1))

  return {
    startTimestamp: start.toISOString(),
    endTimestamp: nextMonth.toISOString(),
  }
}

function normalizeMonth(year: number, month: number) {
  let normalizedYear = year
  let normalizedMonth = month

  if (normalizedMonth < 1 || normalizedMonth > 12) {
    const date = new Date(Date.UTC(year, month - 1, 1))
    normalizedYear = date.getUTCFullYear()
    normalizedMonth = date.getUTCMonth() + 1
  }

  return { year: normalizedYear, month: normalizedMonth }
}

async function resolveSnapshotBounds(): Promise<{
  min: MonthCursor
  max: MonthCursor
}> {
  const now = new Date()
  const currentCursor = normalizeMonth(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1
  )
  const earliest = await fetchEarliestTimeLogCursor()

  if (!earliest) {
    return { min: currentCursor, max: currentCursor }
  }

  const normalizedEarliest = normalizeMonth(earliest.year, earliest.month)

  if (compareMonthCursor(normalizedEarliest, currentCursor) > 0) {
    return { min: currentCursor, max: currentCursor }
  }

  return { min: normalizedEarliest, max: currentCursor }
}

async function fetchEarliestTimeLogCursor(): Promise<MonthCursor | null> {
  const [row] = await db
    .select({ earliestDate: sql<string | null>`MIN(${timeLogs.createdAt})` })
    .from(timeLogs)
    .where(isNull(timeLogs.deletedAt))
    .limit(1)

  if (!row?.earliestDate) {
    return null
  }

  const date = new Date(row.earliestDate)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  }
}

function clampMonthCursor(
  cursor: MonthCursor,
  min: MonthCursor,
  max: MonthCursor
): MonthCursor {
  if (compareMonthCursor(cursor, min) < 0) {
    return min
  }

  if (compareMonthCursor(cursor, max) > 0) {
    return max
  }

  return cursor
}

function compareMonthCursor(a: MonthCursor, b: MonthCursor) {
  const aValue = a.year * 12 + (a.month - 1)
  const bValue = b.year * 12 + (b.month - 1)

  if (aValue < bValue) {
    return -1
  }
  if (aValue > bValue) {
    return 1
  }
  return 0
}
