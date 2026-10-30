import { clientNameSql, personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  sql,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import type { ParsedSort } from '@/lib/pagination/sort'
import type { TimeLogSortField } from '@/lib/time-logs/filters'
import { db } from '@/lib/db'
import { billingTypeAsOfSql } from '@/lib/queries/clients/billing-terms'
import {
  companies,
  hourBlocks,
  projects,
  tasks,
  timeLogTasks,
  timeLogs,
  users,
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

  // Counted the way the monthly close counts them: blocks with this billing
  // month, for a client prepaid as of it, whether or not it is billed that
  // month (a block counts in the month it was bought).
  const prepaidFilters = [
    eq(hourBlocks.billingMonth, startDate),
    isNull(hourBlocks.deletedAt),
    sql`${billingTypeAsOfSql(startDate)} = 'prepaid'`,
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
    sumHoursWithProjectFilter({
      filters: myFilters,
      projectType: 'NON_CLIENT',
    }),
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
  const page = await fetchTimeLogPage({
    userId: user.id,
    from: startDate,
    to: endDate,
    limit: options.limit ?? HOURS_WIDGET_LOG_PAGE_SIZE,
    offset: options.offset,
  })
  return { items: page.items, totalCount: page.totalCount }
}

export type TimeLogPageFilters = {
  userId?: string
  clientCompanyId?: string
  projectId?: string
  /** Inclusive `logged_on` bounds, `YYYY-MM-DD`. */
  from?: string
  to?: string
  limit: number
  offset?: number
  /** Archived (soft-deleted) logs instead of live ones. */
  archived?: boolean
  /** Defaults to newest first. */
  sort?: ParsedSort<TimeLogSortField>
}

/**
 * Time logs on live projects, newest first, offset-paged, with the total
 * rows and hours across every page. Shared by the home Hours widget (my
 * logs this month) and the Time logs page (everyone's, filtered). Callers
 * check access: anyone else's logs are admin-only.
 */
export async function fetchTimeLogPage(
  filters: TimeLogPageFilters
): Promise<DashboardTimeLogPage & { totalHours: number }> {
  const limit = Math.max(1, filters.limit)
  const offset = Math.max(0, filters.offset ?? 0)

  const where = and(
    filters.userId ? eq(timeLogs.userId, filters.userId) : undefined,
    filters.clientCompanyId
      ? eq(projects.companyId, filters.clientCompanyId)
      : undefined,
    filters.projectId ? eq(timeLogs.projectId, filters.projectId) : undefined,
    filters.from ? gte(timeLogs.loggedOn, filters.from) : undefined,
    filters.to ? lte(timeLogs.loggedOn, filters.to) : undefined,
    filters.archived
      ? isNotNull(timeLogs.deletedAt)
      : isNull(timeLogs.deletedAt),
    isNull(projects.deletedAt)
  )

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: timeLogs.id,
        loggedOn: timeLogs.loggedOn,
        hours: timeLogs.hours,
        note: timeLogs.note,
        createdAt: timeLogs.createdAt,
        userId: timeLogs.userId,
        userName: sql<
          string | null
        >`coalesce(${personNameSql}, ${users.email})`,
        userAvatarUrl: personAvatarSql,
        projectId: projects.id,
        projectName: projects.name,
        projectSlug: projects.slug,
        projectType: projects.type,
        clientCompanyId: companies.id,
        clientName: clientNameSql,
        clientSlug: companies.slug,
        companyId: companies.id,
      })
      .from(timeLogs)
      .innerJoin(projects, eq(timeLogs.projectId, projects.id))
      .leftJoin(companies, eq(projects.companyId, companies.id))
      .leftJoin(users, eq(users.id, timeLogs.userId))
      .where(where)
      // createdAt breaks ties within a day; id makes the order total, so paging
      // can't show or skip a row because two logs share a timestamp.
      // The chosen column first; date (newest), createdAt and id break ties
      // so paging can't show or skip a row.
      .orderBy(
        ...timeLogSortOrder(filters.sort),
        desc(timeLogs.loggedOn),
        desc(timeLogs.createdAt),
        desc(timeLogs.id)
      )
      .limit(limit)
      .offset(offset),
    // numeric hours arrive as strings: sum in SQL, not JS floats.
    db
      .select({
        count: sql<number>`count(*)`,
        hours: sql<string>`coalesce(sum(${timeLogs.hours}), 0)`,
      })
      .from(timeLogs)
      .innerJoin(projects, eq(timeLogs.projectId, projects.id))
      .where(where),
  ])

  const totalCount = Number(totals?.count ?? 0)
  const totalHours = parseHours(totals?.hours ?? '0')

  if (!rows.length) {
    return { items: [], totalCount, totalHours }
  }

  const tasksByLog = await fetchLinkedTasks(rows.map(row => row.id))

  const items: DashboardTimeLogEntry[] = rows.map(row => ({
    id: row.id,
    loggedOn: row.loggedOn,
    hours: parseHours(row.hours),
    note: row.note ?? null,
    userId: row.userId,
    userName: row.userName ?? null,
    userAvatarUrl: row.userAvatarUrl ?? null,
    projectId: row.projectId,
    projectName: row.projectName ?? 'Untitled project',
    projectSlug: row.projectSlug ?? null,
    projectType: row.projectType,
    clientCompanyId: row.clientCompanyId ?? null,
    clientName: row.clientName ?? null,
    clientSlug: row.clientSlug ?? null,
    companyId: row.companyId,
    tasks: tasksByLog.get(row.id) ?? [],
    taskTitles: (tasksByLog.get(row.id) ?? []).map(task => task.title),
  }))

  return { items, totalCount, totalHours }
}

/**
 * Every live (or archived) log on a live project, no other filter: the
 * `of N` in the Time logs page's `Showing X of N`.
 */
export async function countTimeLogs({
  archived = false,
}: { archived?: boolean } = {}): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(timeLogs)
    .innerJoin(projects, eq(timeLogs.projectId, projects.id))
    .where(
      and(
        archived ? isNotNull(timeLogs.deletedAt) : isNull(timeLogs.deletedAt),
        isNull(projects.deletedAt)
      )
    )
  return Number(row?.count ?? 0)
}

async function fetchLinkedTasks(
  timeLogIds: string[]
): Promise<Map<string, { id: string; title: string }[]>> {
  if (!timeLogIds.length) {
    return new Map()
  }

  const rows = await db
    .select({
      timeLogId: timeLogTasks.timeLogId,
      id: tasks.id,
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

  const byLog = new Map<string, { id: string; title: string }[]>()
  rows.forEach(row => {
    if (!row.title) {
      return
    }
    const existing = byLog.get(row.timeLogId) ?? []
    existing.push({ id: row.id, title: row.title })
    byLog.set(row.timeLogId, existing)
  })

  return byLog
}

function parseHours(value: string | null): number {
  const parsed = Number(value ?? '0')
  return Number.isFinite(parsed) ? Number(parsed.toFixed(HOURS_PRECISION)) : 0
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

  // Filter by project type by joining with projects table
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
    .where(
      and(...conditions, projectTypeCondition, isNull(projects.deletedAt))
    )) as Array<{
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

  // Joined so the filters can read the block's company.
  const [row] = (await db
    .select({
      totalHours: sql<
        string | null
      >`COALESCE(SUM(${hourBlocks.hoursPurchased}), '0')`,
    })
    .from(hourBlocks)
    .innerJoin(companies, eq(hourBlocks.companyId, companies.id))
    .where(and(...conditions))) as Array<{
    totalHours: string | null
  }>

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

function timeLogSortOrder(sort: ParsedSort<TimeLogSortField> | undefined) {
  if (!sort || (sort.field === 'date' && sort.direction === 'desc')) return []
  const dir = (expression: SQL | AnyColumn) =>
    sort.direction === 'asc' ? asc(expression) : desc(expression)
  switch (sort.field) {
    case 'date':
      return [dir(timeLogs.loggedOn)]
    case 'hours':
      return [dir(timeLogs.hours)]
    case 'person':
      return [dir(sql`lower(coalesce(${personNameSql}, ${users.email}))`)]
    case 'client':
      // Logs without a client (internal/personal projects) sort last.
      return [sql`${clientNameSql} is null`, dir(sql`lower(${clientNameSql})`)]
    case 'project':
      return [dir(sql`lower(${projects.name})`)]
  }
}
