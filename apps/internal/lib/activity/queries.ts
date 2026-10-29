'use server'

import 'server-only'

import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityLogs, users } from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { canReadActivity } from '@/lib/auth/roles'
import { canWorkTask } from '@/lib/projects/access'
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
    targetClientId: string | null
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
  targetClientId: activityLogs.targetClientId,
  targetProjectId: activityLogs.targetProjectId,
  contextRoute: activityLogs.contextRoute,
  metadata: activityLogs.metadata,
  createdAt: activityLogs.createdAt,
} as const

const actorSelection = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  avatarUrl: users.avatarUrl,
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
  if (filters.projectId || filters.clientId || !filters.targetId) return false

  const types =
    typeof filters.targetType === 'string'
      ? [filters.targetType]
      : (filters.targetType ?? [])
  if (types.length !== 1 || types[0] !== 'TASK') return false

  return canWorkTask(user, filters.targetId)
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
  if (!user || !(await canReadActivityFor(user, filters))) {
    throw new ForbiddenError('Not allowed to read this activity')
  }

  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  )

  const whereClause = combineConditions([buildFilterConditions(filters)])

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
    limitedRows.map(mapToActivityLog)
  )
  const lastRow = limitedRows[limitedRows.length - 1]
  const nextCursor =
    hasMore && lastRow ? encodeCursor(lastRow.log.createdAt, lastRow.log.id) : null

  return {
    logs,
    hasMore,
    nextCursor,
  }
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
    gte(activityLogs.createdAt, since),
    until ? lte(activityLogs.createdAt, until) : undefined,
    ...buildAttributionConditions({ source, actorId }),
    targetTypes.length ? inArray(activityLogs.targetType, targetTypes) : undefined,
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

  if (filters.clientId) {
    conditions.push(eq(activityLogs.targetClientId, filters.clientId))
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

const CURSOR_SEPARATOR = "|"

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
  const filtered = conditions.filter(
    (condition): condition is SqlExpression => Boolean(condition)
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
    target_client_id: log.targetClientId,
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
