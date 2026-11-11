import 'server-only'

import { cache } from 'react'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'

import type { ProjectTypeValue } from '@/lib/types'
import { db } from '@/lib/db'
import { leadContactNameSql } from '@/lib/leads/lead-display'
import {
  companies as companiesTable,
  leads as leadsTable,
  projects as projectsTable,
  taskAssigneeMetadata as taskAssigneeMetadataTable,
  taskAssignees as taskAssigneesTable,
  tasks as tasksTable,
} from '@/lib/db/schema'

export type AssignedTaskSummary = {
  id: string
  title: string
  description: string | null
  status: string
  dueOn: string | null
  updatedAt: string | null
  sortOrder: number | null
  /** Null for a lead task: a task is on a project or a lead, never both. */
  project: {
    id: string
    name: string
    slug: string | null
    type: ProjectTypeValue
    createdBy: string | null
  } | null
  client: {
    id: string
    name: string
    slug: string | null
  } | null
  /** The lead a lead task belongs to. */
  lead: { id: string; name: string } | null
}

export type AssignedTaskSummaryResult = {
  items: AssignedTaskSummary[]
  totalCount: number
  /**
   * Assigned DONE tasks that finished before `doneSince` and were therefore
   * withheld. Zero when no window is applied. Drives whether the board offers
   * to widen the window.
   */
  olderDoneCount: number
}

const DEFAULT_LIMIT = 12

/**
 * Shared row filter for "tasks assigned to this user that still matter":
 * not deleted, not archived, and not yet accepted.
 */
/**
 * ON clause for the (left) assignee join. Person-scoping and the soft-delete
 * filter live HERE, not in WHERE — in the everyone view an unassigned task
 * joins to no assignee row, and a WHERE filter on assignee columns would
 * silently drop it.
 */
function assigneeJoinCondition(userId: string | null) {
  return and(
    eq(taskAssigneesTable.taskId, tasksTable.id),
    isNull(taskAssigneesTable.deletedAt),
    ...(userId ? [eq(taskAssigneesTable.userId, userId)] : [])
  )
}

/**
 * Scope shared by every My Tasks query: an optional single client, and
 * project types the board is hiding. A client selection already implies
 * CLIENT-type projects, so the type exclusion only bites in the all-clients
 * view — but it's applied unconditionally so the two never disagree.
 *
 * Lead tasks have no project. They show in the all-clients view (no project
 * type hides them) and drop out once a client is picked.
 */
function projectScopeConditions(
  companyId: string | null,
  hiddenProjectTypes: readonly ProjectTypeValue[],
  projectIds: readonly string[] | null = null
) {
  const projectConditions = [
    // Non-admin viewers: only projects they can work (null = every project).
    ...(projectIds === null
      ? []
      : projectIds.length > 0
        ? [inArray(projectsTable.id, [...projectIds])]
        : [sql`false`]),
    ...(companyId ? [eq(projectsTable.companyId, companyId)] : []),
    ...(hiddenProjectTypes.length > 0
      ? [notInArray(projectsTable.type, [...hiddenProjectTypes])]
      : []),
  ]

  const projectTask = and(isNotNull(tasksTable.projectId), ...projectConditions)

  return [
    companyId ? projectTask : or(isNull(tasksTable.projectId), projectTask),
  ]
}

function assignedTaskConditions(userId: string | null) {
  return [
    // A person-scoped board keeps assigned-only semantics; the everyone
    // view (null) includes unassigned tasks — that's the planning session's
    // whole picture.
    ...(userId ? [isNotNull(taskAssigneesTable.userId)] : []),
    isNull(tasksTable.deletedAt),
    // A lead task joins no project row, which reads as not archived.
    isNull(projectsTable.deletedAt),
    isNull(tasksTable.acceptedAt),
  ]
}

const STATUS_PRIORITY_SQL = sql`
  CASE
    WHEN ${tasksTable.status} = 'BLOCKED' THEN 0
    WHEN ${tasksTable.status} = 'IN_PROGRESS' THEN 1
    WHEN ${tasksTable.status} = 'ON_DECK' THEN 2
    WHEN ${tasksTable.status} = 'DONE' THEN 3
    ELSE 999
  END
`

type FetchAssignedTasksSummaryOptions = {
  /** Null = tasks assigned to ANYONE (the board's "All tasks" view). */
  userId: string | null
  /** Restrict to one client's projects (null/undefined = every client). */
  companyId?: string | null
  /** Project types to withhold (e.g. PERSONAL, INTERNAL); empty = show all. */
  hiddenProjectTypes?: readonly ProjectTypeValue[]
  /** Only these projects (a non-admin's workable set); null = every project. */
  projectIds?: readonly string[] | null
  limit?: number | null
  /**
   * Rows to skip before `limit` applies. Only meaningful with a `userId`:
   * the everyone view joins one row per assignee and dedupes afterwards, so
   * an offset there would skip tasks the dedupe would have collapsed.
   */
  offset?: number
  includeCompletedStatuses?: boolean
  /**
   * ISO instant. When set, DONE tasks completed before it are withheld;
   * every other status is unaffected. Keeps the board's Done column to a
   * rolling window instead of an ever-growing archive.
   */
  doneSince?: string | null
  /**
   * 'status' (default): Blocked, In progress, On deck, then drag order and
   * due date (the board). 'due': overdue and soonest-due first, undated
   * last (the home widget's flat list).
   */
  order?: 'status' | 'due'
}

async function loadAssignedTaskSummaries({
  userId,
  companyId = null,
  hiddenProjectTypes = [],
  projectIds = null,
  limit = DEFAULT_LIMIT,
  offset = 0,
  includeCompletedStatuses = true,
  doneSince = null,
  order = 'status',
}: FetchAssignedTasksSummaryOptions): Promise<AssignedTaskSummaryResult> {
  const normalizedLimit =
    typeof limit === 'number' && Number.isFinite(limit)
      ? Math.max(1, limit)
      : limit === null
        ? null
        : DEFAULT_LIMIT
  const normalizedOffset =
    Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0

  const baseConditions = [
    ...assignedTaskConditions(userId),
    ...projectScopeConditions(companyId, hiddenProjectTypes, projectIds),
  ]

  if (!includeCompletedStatuses) {
    baseConditions.push(ne(tasksTable.status, 'DONE'))
  }

  // Applies to DONE rows only, so the active columns never shrink. A DONE row
  // with a null completed_at stays visible on purpose: it would otherwise be
  // unreachable at every window size, and an extra card beats a lost one.
  const doneWindowCondition =
    includeCompletedStatuses && doneSince
      ? or(
          ne(tasksTable.status, 'DONE'),
          isNull(tasksTable.completedAt),
          gte(tasksTable.completedAt, doneSince)
        )
      : null

  if (doneWindowCondition) {
    baseConditions.push(doneWindowCondition)
  }

  const whereClause = and(...baseConditions)

  // Status leads so a flat list (the home widget) reads Blocked, then In
  // progress, then On deck. The board groups by status into columns, so only
  // the keys after it -- the column's drag order, then due date -- shape what
  // it shows. Keep this in step with `sortAssignedTasks`.
  const orderExpressions =
    order === 'due'
      ? [
          sql`${tasksTable.dueOn} asc nulls last`,
          STATUS_PRIORITY_SQL,
          asc(tasksTable.createdAt),
          asc(tasksTable.title),
        ]
      : [
          STATUS_PRIORITY_SQL,
          sql`CASE WHEN ${taskAssigneeMetadataTable.sortOrder} IS NULL THEN 1 ELSE 0 END`,
          asc(taskAssigneeMetadataTable.sortOrder),
          sql`CASE WHEN ${tasksTable.dueOn} IS NULL THEN 1 ELSE 0 END`,
          asc(tasksTable.dueOn),
          desc(sql`COALESCE(${tasksTable.updatedAt}, ${tasksTable.createdAt})`),
          asc(tasksTable.title),
        ]

  const baseQuery = db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      dueOn: tasksTable.dueOn,
      updatedAt: tasksTable.updatedAt,
      createdAt: tasksTable.createdAt,
      sortOrder: taskAssigneeMetadataTable.sortOrder,
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        slug: projectsTable.slug,
        type: projectsTable.type,
        createdBy: projectsTable.createdBy,
      },
      client: {
        id: companiesTable.id,
        name: companiesTable.name,
        slug: companiesTable.slug,
      },
      lead: {
        id: leadsTable.id,
        name: leadContactNameSql,
      },
    })
    .from(tasksTable)
    .leftJoin(taskAssigneesTable, assigneeJoinCondition(userId))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(companiesTable, eq(projectsTable.companyId, companiesTable.id))
    .leftJoin(
      leadsTable,
      and(eq(leadsTable.id, tasksTable.leadId), isNull(leadsTable.deletedAt))
    )
    .leftJoin(
      taskAssigneeMetadataTable,
      and(
        eq(taskAssigneeMetadataTable.taskId, tasksTable.id),
        eq(taskAssigneeMetadataTable.userId, taskAssigneesTable.userId),
        isNull(taskAssigneeMetadataTable.deletedAt)
      )
    )
    .where(whereClause)
    .orderBy(...orderExpressions)

  const rows =
    normalizedLimit !== null
      ? await baseQuery.limit(normalizedLimit).offset(normalizedOffset)
      : await baseQuery

  // An unbounded query already returned every match — counting again
  // would repeat the full three-table join for a number we have.
  let totalCount = rows.length
  if (normalizedLimit !== null) {
    const totalResult = await db
      .select({
        count: sql<number>`count(distinct ${tasksTable.id})`,
      })
      .from(tasksTable)
      .leftJoin(taskAssigneesTable, assigneeJoinCondition(userId))
      .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(whereClause)

    totalCount = Number(totalResult[0]?.count ?? 0)
  }

  const olderDoneCount = doneSince
    ? await countAssignedDoneBefore(
        userId,
        doneSince,
        companyId,
        hiddenProjectTypes,
        projectIds
      )
    : 0

  // In the all-assignees view a task with two assignees joins to two rows;
  // keep the first (best-ordered) one. A single-user query never duplicates.
  const seenTaskIds = new Set<string>()
  const dedupedRows = rows.filter(row => {
    if (seenTaskIds.has(row.id)) {
      return false
    }
    seenTaskIds.add(row.id)
    return true
  })
  if (normalizedLimit === null) {
    totalCount = dedupedRows.length
  }

  const items: AssignedTaskSummary[] = dedupedRows.map(row => {
    const updatedSource = row.updatedAt ?? row.createdAt ?? null

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      status: row.status,
      dueOn: row.dueOn ?? null,
      updatedAt: updatedSource,
      sortOrder: row.sortOrder ?? null,
      project: row.project?.id
        ? {
            id: row.project.id,
            name: row.project.name,
            slug: row.project.slug ?? null,
            type: row.project.type as ProjectTypeValue,
            createdBy: row.project.createdBy ?? null,
          }
        : null,
      client: row.client?.id
        ? {
            id: row.client.id,
            name: row.client.name ?? 'Unnamed client',
            slug: row.client.slug ?? null,
          }
        : null,
      lead: row.lead?.id ? { id: row.lead.id, name: row.lead.name } : null,
    }
  })

  return { items, totalCount, olderDoneCount }
}

/**
 * Assigned DONE tasks completed before `before`. Rows with a null
 * completed_at are excluded: they're always shown, so they're never "older".
 */
async function countAssignedDoneBefore(
  userId: string | null,
  before: string,
  companyId: string | null = null,
  hiddenProjectTypes: readonly ProjectTypeValue[] = [],
  projectIds: readonly string[] | null = null
): Promise<number> {
  const [result] = await db
    // Distinct: the all-assignees view joins one row per assignee.
    .select({ count: sql<number>`count(distinct ${tasksTable.id})` })
    .from(tasksTable)
    .leftJoin(taskAssigneesTable, assigneeJoinCondition(userId))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(
      and(
        ...assignedTaskConditions(userId),
        ...projectScopeConditions(companyId, hiddenProjectTypes, projectIds),
        eq(tasksTable.status, 'DONE'),
        isNotNull(tasksTable.completedAt),
        lt(tasksTable.completedAt, before)
      )
    )

  return Number(result?.count ?? 0)
}

export type AssignedDoneSliceResult = {
  items: AssignedTaskSummary[]
  /** DONE tasks still older than this slice, for the next "load previous". */
  olderDoneCount: number
}

/**
 * One step of the board's "load previous two weeks": assigned DONE tasks
 * completed in `[since, before)`, plus how many remain beyond it.
 *
 * A half-open range rather than "everything since X" so widening appends only
 * what the client doesn't already have — the board keeps the rows it already
 * rendered instead of re-receiving and re-reconciling them.
 */
export async function listAssignedDoneSlice({
  userId,
  companyId = null,
  hiddenProjectTypes = [],
  projectIds = null,
  since,
  before,
}: {
  userId: string | null
  companyId?: string | null
  hiddenProjectTypes?: readonly ProjectTypeValue[]
  projectIds?: readonly string[] | null
  since: string
  before: string
}): Promise<AssignedDoneSliceResult> {
  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      dueOn: tasksTable.dueOn,
      updatedAt: tasksTable.updatedAt,
      createdAt: tasksTable.createdAt,
      sortOrder: taskAssigneeMetadataTable.sortOrder,
      project: {
        id: projectsTable.id,
        name: projectsTable.name,
        slug: projectsTable.slug,
        type: projectsTable.type,
        createdBy: projectsTable.createdBy,
      },
      client: {
        id: companiesTable.id,
        name: companiesTable.name,
        slug: companiesTable.slug,
      },
      lead: {
        id: leadsTable.id,
        name: leadContactNameSql,
      },
    })
    .from(tasksTable)
    .leftJoin(taskAssigneesTable, assigneeJoinCondition(userId))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(companiesTable, eq(projectsTable.companyId, companiesTable.id))
    .leftJoin(
      leadsTable,
      and(eq(leadsTable.id, tasksTable.leadId), isNull(leadsTable.deletedAt))
    )
    .leftJoin(
      taskAssigneeMetadataTable,
      and(
        eq(taskAssigneeMetadataTable.taskId, tasksTable.id),
        eq(taskAssigneeMetadataTable.userId, taskAssigneesTable.userId),
        isNull(taskAssigneeMetadataTable.deletedAt)
      )
    )
    .where(
      and(
        ...assignedTaskConditions(userId),
        ...projectScopeConditions(companyId, hiddenProjectTypes, projectIds),
        eq(tasksTable.status, 'DONE'),
        isNotNull(tasksTable.completedAt),
        gte(tasksTable.completedAt, since),
        lt(tasksTable.completedAt, before)
      )
    )
    .orderBy(desc(tasksTable.completedAt))

  // All-assignees view: one row per assignee per task — keep the first.
  const seenSliceTaskIds = new Set<string>()
  const dedupedSliceRows = rows.filter(row => {
    if (seenSliceTaskIds.has(row.id)) {
      return false
    }
    seenSliceTaskIds.add(row.id)
    return true
  })

  const items: AssignedTaskSummary[] = dedupedSliceRows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    dueOn: row.dueOn ?? null,
    updatedAt: row.updatedAt ?? row.createdAt ?? null,
    sortOrder: row.sortOrder ?? null,
    project: row.project?.id
      ? {
          id: row.project.id,
          name: row.project.name,
          slug: row.project.slug ?? null,
          type: row.project.type as ProjectTypeValue,
          createdBy: row.project.createdBy ?? null,
        }
      : null,
    client: row.client?.id
      ? {
          id: row.client.id,
          name: row.client.name ?? 'Unnamed client',
          slug: row.client.slug ?? null,
        }
      : null,
    lead: row.lead?.id ? { id: row.lead.id, name: row.lead.name } : null,
  }))

  return {
    items,
    olderDoneCount: await countAssignedDoneBefore(
      userId,
      since,
      companyId,
      hiddenProjectTypes,
      projectIds
    ),
  }
}

export const fetchAssignedTasksSummary = cache(
  (options: FetchAssignedTasksSummaryOptions) =>
    loadAssignedTaskSummaries(options)
)

export function listAssignedTaskSummaries(
  options: FetchAssignedTasksSummaryOptions
) {
  return loadAssignedTaskSummaries(options)
}

/**
 * Where a live task lives (its project, or its lead) without hydrating any
 * project graph — used by the task sheet and the My Tasks deep-link path.
 * Soft-deleted tasks resolve to null.
 */
export async function getActiveTaskHome(
  taskId: string
): Promise<{ projectId: string | null; leadId: string | null } | null> {
  const rows = await db
    .select({ projectId: tasksTable.projectId, leadId: tasksTable.leadId })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), isNull(tasksTable.deletedAt)))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Where a task lives, archived or not: the task sheet in a stack opens
 * archived tasks too (the Review tab links them).
 */
export async function getTaskHome(
  taskId: string
): Promise<{ projectId: string | null; leadId: string | null } | null> {
  const rows = await db
    .select({ projectId: tasksTable.projectId, leadId: tasksTable.leadId })
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId))
    .limit(1)

  return rows[0] ?? null
}
