'use server'

import 'server-only'

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  type SQL,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import { activityLogs, projects, users } from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/session'
import {
  assertAdmin,
  isAdmin,
  listAccessibleClientIds,
} from '@/lib/auth/permissions'
import type { UserRoleValue } from '@/lib/types'
import type { Json } from '@/lib/types/json'

import {
  CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES,
  type ActivityLogWithActor,
  type ActivityQueryFilters,
  type ActivityQueryResult,
} from './types'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const DEFAULT_RECENT_ACTIVITY_LIMIT = 200

type SqlExpression = SQL<unknown>

type ActivityLogSelection = {
  log: {
    id: string
    actorId: string
    actorRole: UserRoleValue
    verb: string
    summary: string
    targetType: string
    targetId: string | null
    targetClientId: string | null
    targetProjectId: string | null
    contextRoute: string | null
    metadata: Json
    createdAt: string
    updatedAt: string
    deletedAt: string | null
    restoredAt: string | null
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
  verb: activityLogs.verb,
  summary: activityLogs.summary,
  targetType: activityLogs.targetType,
  targetId: activityLogs.targetId,
  targetClientId: activityLogs.targetClientId,
  targetProjectId: activityLogs.targetProjectId,
  contextRoute: activityLogs.contextRoute,
  metadata: activityLogs.metadata,
  createdAt: activityLogs.createdAt,
  updatedAt: activityLogs.updatedAt,
  deletedAt: activityLogs.deletedAt,
  restoredAt: activityLogs.restoredAt,
} as const

const actorSelection = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  avatarUrl: users.avatarUrl,
} as const

const EMPTY_RESULT: ActivityQueryResult = {
  logs: [],
  hasMore: false,
  nextCursor: null,
}

/**
 * Access control lives here, not in the callers (this project has NO RLS):
 * admins see everything; non-admins are restricted to
 * CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES AND rows attached to a client they
 * belong to (via client_members) or a project they can access. Requested
 * filters narrow within that scope — they can never widen it.
 */
export async function fetchActivityLogs(
  user: AppUser,
  filters: ActivityQueryFilters
): Promise<ActivityQueryResult> {
  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  )

  const scope = await buildAccessScopeConditions(user, filters)

  if (scope === 'no-access') {
    return EMPTY_RESULT
  }

  const whereClause = combineConditions([
    buildFilterConditions(filters),
    ...scope,
  ])

  const baseQuery = db
    .select({
      log: activityLogSelection,
      actor: actorSelection,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))

  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery

  const rows = (await filteredQuery
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit + 1)) as ActivityLogSelection[]

  const hasMore = rows.length > limit
  const limitedRows = hasMore ? rows.slice(0, limit) : rows
  const logs = limitedRows.map(mapToActivityLog)
  const nextCursor = hasMore
    ? limitedRows[limitedRows.length - 1]?.log.createdAt ?? null
    : null

  return {
    logs,
    hasMore,
    nextCursor,
  }
}

/**
 * Returns every log in the window with NO row scoping — admin-only, enforced
 * structurally: the caller must pass the current user and non-admins throw
 * ForbiddenError, so a future non-admin call site fails loudly instead of
 * silently leaking. (Sole caller today: the dashboard recent-activity
 * summary route, which additionally 403s non-admins up front.)
 */
export async function fetchActivityLogsSince(
  user: AppUser,
  {
    since,
    until,
    limit,
    includeDeleted,
  }: {
    since: string
    until?: string
    limit?: number
    includeDeleted?: boolean
  }
): Promise<ActivityLogWithActor[]> {
  assertAdmin(user)

  const effectiveLimit = Math.min(
    Math.max(limit ?? DEFAULT_RECENT_ACTIVITY_LIMIT, 1),
    DEFAULT_RECENT_ACTIVITY_LIMIT
  )

  const whereClause = combineConditions([
    includeDeleted ? undefined : isNull(activityLogs.deletedAt),
    gte(activityLogs.createdAt, since),
    until ? lte(activityLogs.createdAt, until) : undefined,
  ])

  const baseQuery = db
    .select({
      log: activityLogSelection,
      actor: actorSelection,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))

  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery

  const rows = (await filteredQuery
    .orderBy(asc(activityLogs.createdAt))
    .limit(effectiveLimit)) as ActivityLogSelection[]

  return rows.map(mapToActivityLog)
}

function buildFilterConditions(filters: ActivityQueryFilters) {
  const conditions: Array<SqlExpression | undefined> = []

  if (!filters.includeDeleted) {
    conditions.push(isNull(activityLogs.deletedAt))
  }

  if (filters.targetId) {
    conditions.push(eq(activityLogs.targetId, filters.targetId))
  }

  if (filters.projectId) {
    conditions.push(eq(activityLogs.targetProjectId, filters.projectId))
  }

  if (filters.clientId) {
    conditions.push(eq(activityLogs.targetClientId, filters.clientId))
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
    conditions.push(lt(activityLogs.createdAt, filters.cursor))
  }

  return combineConditions(conditions)
}

/**
 * Extra WHERE conditions enforcing the caller's access. Admins get none.
 * Non-admins get:
 *   1. targetType restricted to CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES — if the
 *      caller explicitly requested only types outside that set, short-circuit
 *      to 'no-access' rather than running a query that matches nothing.
 *   2. Row scope: the log must point at a client they belong to, or a project
 *      they can access — their clients' projects, their own PERSONAL
 *      projects, or any INTERNAL project. INTERNAL is included because that
 *      mirrors access everywhere else (ensureClientAccessByProjectId,
 *      scopeProjects, the My Tasks query all grant INTERNAL to every
 *      authenticated user); excluding it here empties the activity panel of
 *      internal-project tasks that non-admins legitimately work on.
 */
async function buildAccessScopeConditions(
  user: AppUser,
  filters: ActivityQueryFilters
): Promise<SqlExpression[] | 'no-access'> {
  if (isAdmin(user)) {
    return []
  }

  const allowedTypes: string[] = [...CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES]

  if (filters.targetType) {
    const requested = Array.isArray(filters.targetType)
      ? filters.targetType
      : [filters.targetType]

    if (!requested.some(type => allowedTypes.includes(type))) {
      return 'no-access'
    }
  }

  const rowScope = await buildNonAdminRowScope(user)

  if (rowScope === 'no-access') {
    return 'no-access'
  }

  return [inArray(activityLogs.targetType, allowedTypes), rowScope]
}

async function buildNonAdminRowScope(
  user: AppUser
): Promise<SqlExpression | 'no-access'> {
  const clientIds = await listAccessibleClientIds(user)

  const nonClientProjectAccess = or(
    and(eq(projects.type, 'PERSONAL'), eq(projects.createdBy, user.id)),
    eq(projects.type, 'INTERNAL')
  )

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        isNull(projects.deletedAt),
        clientIds.length
          ? or(inArray(projects.clientId, clientIds), nonClientProjectAccess)
          : nonClientProjectAccess
      )
    )

  const projectIds = projectRows.map(row => row.id)

  const scopes: SqlExpression[] = []

  if (clientIds.length) {
    scopes.push(inArray(activityLogs.targetClientId, clientIds))
  }

  if (projectIds.length) {
    scopes.push(inArray(activityLogs.targetProjectId, projectIds))
  }

  if (!scopes.length) {
    return 'no-access'
  }

  if (scopes.length === 1) {
    return scopes[0]
  }

  const combined = or(...scopes)

  return combined ?? 'no-access'
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
    verb: log.verb,
    summary: log.summary,
    target_type: log.targetType,
    target_id: log.targetId,
    target_client_id: log.targetClientId,
    target_project_id: log.targetProjectId,
    context_route: log.contextRoute,
    metadata,
    created_at: log.createdAt,
    updated_at: log.updatedAt,
    deleted_at: log.deletedAt,
    restored_at: log.restoredAt,
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
