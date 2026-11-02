import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityLogs, users } from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { roleCan } from '@/lib/auth/capabilities'
import { canReadActivity } from '@/lib/auth/roles'
import { canWorkTask, listWorkableProjectIds } from '@/lib/projects/access'
import { ForbiddenError } from '@/lib/errors/http'
import type { ActivitySourceValue, UserRoleValue } from '@/lib/types'
import type { Json } from '@/lib/types/json'

import { attachActivityReferences } from './references'
import type {
  ActivityLogWithActor,
  ActivityQueryFilters,
  ActivityQueryResult,
} from './types'

/**
 * Page-view verbs were retired in Sep 2026 (they were ~half the table and
 * carried no information). Rows written before that stay in the table for
 * the record but never surface in a feed.
 */
const RETIRED_VERBS = ['PROJECT_VIEWED', 'CLIENT_VIEWED']

/**
 * Billing and portal-access events. They sit on the company (target COMPANY
 * since 0113), so a company feed shows them; anyone who can't manage clients
 * (Sales) never sees them, or the billing behind them.
 */
const BILLING_VERBS = [
  'CLIENT_CREATED',
  'CLIENT_UPDATED',
  'CLIENT_ARCHIVED',
  'CLIENT_RESTORED',
  'CLIENT_DELETED',
  'CONTACT_CLIENT_LINKED',
  'CONTACT_CLIENT_UNLINKED',
  // Says a person got a portal sign-in, which Sales can't see either.
  'CONTACT_INVITED_TO_PORTAL',
]

function billingScope(user: AppUser) {
  return roleCan(user.role, 'clients.manage')
    ? undefined
    : notInArray(activityLogs.verb, BILLING_VERBS)
}

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const DEFAULT_RECENT_ACTIVITY_LIMIT = 200
const MAX_RECENT_ACTIVITY_LIMIT = 1000

type SqlExpression = SQL<unknown>

type ActivityLogSelection = {
  log: {
    id: string
    actorId: string | null
    actorRole: UserRoleValue | null
    source: ActivitySourceValue
    verb: string
    summary: string
    targetType: string
    targetId: string | null
    targetCompanyId: string | null
    targetProjectId: string | null
    contextRoute: string | null
    metadata: Json
    createdAt: string
  }
  actor: {
    id: string | null
    fullName: string | null
    email: string | null
    avatarUrl: string | null
  } | null
}

const activityLogSelection = {
  id: activityLogs.id,
  actorId: activityLogs.actorId,
  actorRole: activityLogs.actorRole,
  source: activityLogs.source,
  verb: activityLogs.verb,
  summary: activityLogs.summary,
  targetType: activityLogs.targetType,
  targetId: activityLogs.targetId,
  targetCompanyId: activityLogs.targetCompanyId,
  targetProjectId: activityLogs.targetProjectId,
  contextRoute: activityLogs.contextRoute,
  metadata: activityLogs.metadata,
  createdAt: activityLogs.createdAt,
} as const

const actorSelection = {
  id: users.id,
  fullName: personNameSql,
  email: users.email,
  avatarUrl: personAvatarSql,
} as const

/**
 * `canReadActivity` plus one async case: a project member (SALES) may read
 * the history of a single task they can work, which the task sheet shows.
 */
async function canReadActivityFor(
  user: AppUser,
  filters: ActivityQueryFilters
): Promise<boolean> {
  if (canReadActivity(user.role, filters)) return true
  if (user.role !== 'SALES') return false
  if (filters.projectId || filters.companyId || !filters.targetId) return false

  const types =
    typeof filters.targetType === 'string'
      ? [filters.targetType]
      : (filters.targetType ?? [])
  if (types.length !== 1 || types[0] !== 'TASK') return false

  return canWorkTask(user, filters.targetId)
}

/**
 * The WHERE clause every per-record reader shares: the requested filters,
 * narrowed to the projects the user can work and, for anyone who can't manage
 * clients, with billing events removed. Throws when the user may not read
 * this activity at all.
 */
async function scopedActivityWhere(
  user: AppUser,
  filters: ActivityQueryFilters
) {
  if (!user || !(await canReadActivityFor(user, filters))) {
    throw new ForbiddenError('Not allowed to read this activity')
  }

  // A member reading a task's history sees only the events from projects
  // they can work: a task moved in from elsewhere keeps its past there.
  const visibleProjectIds = await listWorkableProjectIds(user)
  const projectScope =
    visibleProjectIds === null
      ? undefined
      : visibleProjectIds.length
        ? or(
            isNull(activityLogs.targetProjectId),
            inArray(activityLogs.targetProjectId, visibleProjectIds)
          )
        : isNull(activityLogs.targetProjectId)

  const whereClause = combineConditions([
    buildFilterConditions(filters),
    projectScope,
    billingScope(user),
  ])

  return { whereClause, visibleProjectIds }
}

/**
 * Access control lives here, not in the callers (this project has NO RLS):
 * admins see everything; SALES (CRM staff) may read lead and contact activity
 * only (`canReadActivity`). Requested filters narrow the result set.
 */
export async function fetchActivityLogs(
  user: AppUser,
  filters: ActivityQueryFilters
): Promise<ActivityQueryResult> {
  const { whereClause, visibleProjectIds } = await scopedActivityWhere(
    user,
    filters
  )

  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  )

  const baseQuery = db
    .select({
      log: activityLogSelection,
      actor: actorSelection,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))

  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery

  // `id` breaks ties so rows sharing a `created_at` (bulk inserts land in the
  // same transaction timestamp) page deterministically instead of dropping.
  const rows = (await filteredQuery
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(limit + 1)) as ActivityLogSelection[]

  const hasMore = rows.length > limit
  const limitedRows = hasMore ? rows.slice(0, limit) : rows
  const logs = await attachActivityReferences(
    limitedRows.map(mapToActivityLog),
    visibleProjectIds
  )
  const lastRow = limitedRows[limitedRows.length - 1]
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor(lastRow.log.createdAt, lastRow.log.id)
      : null

  return {
    logs,
    hasMore,
    nextCursor,
  }
}

/**
 * How many rows `fetchActivityLogs` would page through for these filters,
 * under the same access rules: the count on a sheet's collapsed Activity
 * header. One `count(*)` on the target index, no actor join, no references.
 */
export async function countActivityLogs(
  user: AppUser,
  filters: Omit<ActivityQueryFilters, 'cursor' | 'limit'>
): Promise<number> {
  const { whereClause } = await scopedActivityWhere(user, filters)

  const baseQuery = db.select({ value: count() }).from(activityLogs)
  const [row] = await (whereClause ? baseQuery.where(whereClause) : baseQuery)

  return Number(row?.value ?? 0)
}

/**
 * Returns the NEWEST logs in the window (oldest first, for prompting), scoped
 * by the same rule as `fetchActivityLogs` (`canReadActivity`): admins may
 * read every row; SALES only LEAD and CONTACT rows, and only by naming those
 * target types. A caller passing no `targetType` therefore gets the unscoped
 * window, which is admin-only — a future non-admin call site fails loudly
 * instead of silently leaking. (Callers: the dashboard recent-activity
 * summary route, admin-only, and the MCP `recent_activity` tool.)
 */
export async function fetchActivityLogsSince(
  user: AppUser,
  {
    since,
    until,
    limit,
    source,
    actorId,
    targetType,
  }: {
    since: string
    until?: string
    limit?: number
  } & Pick<ActivityQueryFilters, 'source' | 'actorId' | 'targetType'>
): Promise<ActivityLogWithActor[]> {
  if (!user || !canReadActivity(user.role, { targetType })) {
    throw new ForbiddenError('Not allowed to read this activity')
  }

  const targetTypes =
    typeof targetType === 'string' ? [targetType] : (targetType ?? [])

  const effectiveLimit = Math.min(
    Math.max(limit ?? DEFAULT_RECENT_ACTIVITY_LIMIT, 1),
    MAX_RECENT_ACTIVITY_LIMIT
  )

  const whereClause = combineConditions([
    notInArray(activityLogs.verb, RETIRED_VERBS),
    billingScope(user),
    gte(activityLogs.createdAt, since),
    until ? lte(activityLogs.createdAt, until) : undefined,
    ...buildAttributionConditions({ source, actorId }),
    targetTypes.length
      ? inArray(activityLogs.targetType, targetTypes)
      : undefined,
  ])

  const baseQuery = db
    .select({
      log: activityLogSelection,
      actor: actorSelection,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))

  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery

  // Take the newest `limit` rows, then flip to chronological order. Ordering
  // ascending with a limit returned the *oldest* rows of a busy window, so the
  // "recent activity" briefing described the start of the week, not the end.
  const rows = (await filteredQuery
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(effectiveLimit)) as ActivityLogSelection[]

  return rows.reverse().map(mapToActivityLog)
}

function buildFilterConditions(filters: ActivityQueryFilters) {
  const conditions: Array<SqlExpression | undefined> = []

  conditions.push(notInArray(activityLogs.verb, RETIRED_VERBS))

  if (filters.targetId) {
    conditions.push(eq(activityLogs.targetId, filters.targetId))
  }

  if (filters.projectId) {
    conditions.push(eq(activityLogs.targetProjectId, filters.projectId))
  }

  if (filters.companyId) {
    conditions.push(eq(activityLogs.targetCompanyId, filters.companyId))
  }

  conditions.push(...buildAttributionConditions(filters))

  if (filters.since) {
    conditions.push(gte(activityLogs.createdAt, filters.since))
  }

  if (filters.until) {
    conditions.push(lte(activityLogs.createdAt, filters.until))
  }

  if (filters.targetType) {
    const values = Array.isArray(filters.targetType)
      ? filters.targetType
      : [filters.targetType]

    if (values.length === 1) {
      conditions.push(eq(activityLogs.targetType, values[0]))
    } else if (values.length > 1) {
      conditions.push(inArray(activityLogs.targetType, values))
    }
  }

  if (filters.cursor) {
    const cursor = decodeCursor(filters.cursor)
    conditions.push(
      cursor.id
        ? or(
            lt(activityLogs.createdAt, cursor.createdAt),
            and(
              eq(activityLogs.createdAt, cursor.createdAt),
              lt(activityLogs.id, cursor.id)
            )
          )
        : lt(activityLogs.createdAt, cursor.createdAt)
    )
  }

  return combineConditions(conditions)
}

/** Who wrote a row and through which channel: shared by both readers. */
function buildAttributionConditions({
  source,
  actorId,
}: Pick<ActivityQueryFilters, 'source' | 'actorId'>) {
  return [
    source ? eq(activityLogs.source, source) : undefined,
    actorId ? eq(activityLogs.actorId, actorId) : undefined,
  ]
}

const CURSOR_SEPARATOR = '|'

function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}${CURSOR_SEPARATOR}${id}`
}

/** Accepts the legacy bare-timestamp cursor so in-flight clients keep paging. */
function decodeCursor(value: string): { createdAt: string; id: string | null } {
  const separatorIndex = value.lastIndexOf(CURSOR_SEPARATOR)
  if (separatorIndex === -1) {
    return { createdAt: value, id: null }
  }
  return {
    createdAt: value.slice(0, separatorIndex),
    id: value.slice(separatorIndex + 1) || null,
  }
}

function combineConditions(conditions: Array<SqlExpression | undefined>) {
  const filtered = conditions.filter((condition): condition is SqlExpression =>
    Boolean(condition)
  )

  if (!filtered.length) {
    return undefined
  }

  if (filtered.length === 1) {
    return filtered[0]
  }

  return and(...filtered)
}

function mapToActivityLog(row: ActivityLogSelection): ActivityLogWithActor {
  const { log, actor } = row
  const metadata = (log.metadata ?? {}) as ActivityLogWithActor['metadata']

  return {
    id: log.id,
    actor_id: log.actorId,
    actor_role: log.actorRole,
    source: log.source,
    verb: log.verb,
    summary: log.summary,
    target_type: log.targetType,
    target_id: log.targetId,
    target_company_id: log.targetCompanyId,
    target_project_id: log.targetProjectId,
    context_route: log.contextRoute,
    metadata,
    created_at: log.createdAt,
    actor:
      actor && actor.id
        ? {
            id: actor.id,
            full_name: actor.fullName,
            email: actor.email ?? '',
            avatar_url: actor.avatarUrl,
          }
        : null,
  }
}
