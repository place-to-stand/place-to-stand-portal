import 'server-only'

import {
  and,
  desc,
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
import { db } from '@/lib/db'
import {
  clients,
  hourBlocks,
  projects,
  tasks,
  timeLogTasks,
  timeLogs,
} from '@/lib/db/schema'
import {
  HOURS_WIDGET_LOG_PAGE_SIZE,
  type DashboardTimeLogEntry,
  type DashboardTimeLogPage,
  type HoursSnapshot,
  type MonthCursor,
} from '@/lib/dashboard/types'

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

  const myFilters: SQL<unknown>[] = [
    eq(timeLogs.userId, user.id),
    gte(timeLogs.loggedOn, startDate),
    lte(timeLogs.loggedOn, endDate),
    isNull(timeLogs.deletedAt),
  ]

  const baseFilters: SQL<unknown>[] = [
    gte(timeLogs.loggedOn, startDate),
    lte(timeLogs.loggedOn, endDate),
    isNull(timeLogs.deletedAt),
  ]

  const { startTimestamp, endTimestamp } = buildMonthTimestampRange(year, month)
  const prepaidFilters = [
    gte(hourBlocks.createdAt, startTimestamp),
    sql`${hourBlocks.createdAt} < ${endTimestamp}`,
    isNull(hourBlocks.deletedAt),
  ]

  // All five aggregates and the log page derive from the clamped cursor
  // alone — awaiting them one by one cost a serial DB round trip each.
  const [
    // My hours: billable (CLIENT project) hours only
    myHours,
    // Company hours: billable (CLIENT project) hours only
    companyHours,
    // Internal/Personal hours: non-billable project hours for the current user
    internalPersonalHours,
    companyHoursPrepaid,
    timeLogPage,
  ] = await Promise.all([
    sumHoursWithProjectFilter({ filters: myFilters, projectType: 'CLIENT' }),
    sumHoursWithProjectFilter({ filters: baseFilters, projectType: 'CLIENT' }),
    sumHoursWithProjectFilter({ filters: myFilters, projectType: 'NON_CLIENT' }),
    sumPrepaidHours({ filters: prepaidFilters }),
    fetchMyMonthTimeLogs(user, clampedCursor, { offset: 0 }),
  ])

  return {
    month,
    year,
    myHours,
    companyHours,
    companyHoursPrepaid,
    internalPersonalHours,
    scopeLabel: 'All projects',
    minCursor: bounds.min,
    maxCursor: bounds.max,
    timeLogs: timeLogPage,
  }
}

/**
 * A page of my own time logs for one month, newest first. Paged rather than
 * loaded whole: a heavy month can run to hundreds of rows and the widget shows
 * five at a time.
 */
export async function fetchMyMonthTimeLogs(
  user: AppUser,
  cursor: MonthCursor,
  options: { offset?: number; limit?: number } = {}
): Promise<DashboardTimeLogPage> {
  const { year, month } = normalizeMonth(cursor.year, cursor.month)
  const { startDate, endDate } = buildMonthDateRange(year, month)
  const limit = Math.max(1, options.limit ?? HOURS_WIDGET_LOG_PAGE_SIZE)
  const offset = Math.max(0, options.offset ?? 0)

  const windowFilter = and(
    eq(timeLogs.userId, user.id),
    gte(timeLogs.loggedOn, startDate),
    lte(timeLogs.loggedOn, endDate),
    isNull(timeLogs.deletedAt),
    isNull(projects.deletedAt)
  )

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: timeLogs.id,
        loggedOn: timeLogs.loggedOn,
        hours: timeLogs.hours,
        note: timeLogs.note,
        createdAt: timeLogs.createdAt,
        projectId: projects.id,
        projectName: projects.name,
        projectSlug: projects.slug,
        projectType: projects.type,
        clientName: clients.name,
        clientSlug: clients.slug,
      })
      .from(timeLogs)
      .innerJoin(projects, eq(timeLogs.projectId, projects.id))
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(windowFilter)
      // createdAt breaks ties within a day; id makes the order total, so paging
      // can't show or skip a row because two logs share a timestamp.
      .orderBy(desc(timeLogs.loggedOn), desc(timeLogs.createdAt), desc(timeLogs.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(timeLogs)
      .innerJoin(projects, eq(timeLogs.projectId, projects.id))
      .where(windowFilter),
  ])

  const totalCount = Number(countRow?.count ?? 0)

  if (!rows.length) {
    return { items: [], totalCount }
  }

  const taskTitlesByLog = await fetchLinkedTaskTitles(rows.map(row => row.id))

  const items: DashboardTimeLogEntry[] = rows.map(row => ({
    id: row.id,
    loggedOn: row.loggedOn,
    hours: parseHours(row.hours),
    note: row.note ?? null,
    projectId: row.projectId,
    projectName: row.projectName ?? 'Untitled project',
    projectSlug: row.projectSlug ?? null,
    projectType: row.projectType,
    clientName: row.clientName ?? null,
    clientSlug: row.clientSlug ?? null,
    taskTitles: taskTitlesByLog.get(row.id) ?? [],
  }))

  return { items, totalCount }
}

async function fetchLinkedTaskTitles(
  timeLogIds: string[]
): Promise<Map<string, string[]>> {
  if (!timeLogIds.length) {
    return new Map()
  }

  const rows = await db
    .select({
      timeLogId: timeLogTasks.timeLogId,
      title: tasks.title,
    })
    .from(timeLogTasks)
    .innerJoin(tasks, eq(timeLogTasks.taskId, tasks.id))
    .where(
      and(
        inArray(timeLogTasks.timeLogId, timeLogIds),
        isNull(timeLogTasks.deletedAt),
        isNull(tasks.deletedAt)
      )
    )

  const byLog = new Map<string, string[]>()
  rows.forEach(row => {
    if (!row.title) {
      return
    }
    const existing = byLog.get(row.timeLogId) ?? []
    existing.push(row.title)
    byLog.set(row.timeLogId, existing)
  })

  return byLog
}

function parseHours(value: string | null): number {
  const parsed = Number(value ?? '0')
  return Number.isFinite(parsed)
    ? Number(parsed.toFixed(HOURS_PRECISION))
    : 0
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

  // Join with clients to exclude soft-deleted clients
  const [row] = (await db
    .select({
      totalHours: sql<string | null>`COALESCE(SUM(${hourBlocks.hoursPurchased}), '0')`,
    })
    .from(hourBlocks)
    .innerJoin(clients, eq(hourBlocks.clientId, clients.id))
    .where(and(...conditions, isNull(clients.deletedAt)))) as Array<{ totalHours: string | null }>

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
    .select({ earliestDate: sql<string | null>`MIN(${timeLogs.loggedOn})` })
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
