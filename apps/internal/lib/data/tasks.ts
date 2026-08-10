import 'server-only'

import { cache } from 'react'
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm'

import type { ProjectTypeValue } from '@/lib/types'
import { db } from '@/lib/db'
import {
  clients as clientsTable,
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
  project: {
    id: string
    name: string
    slug: string | null
    type: ProjectTypeValue
    createdBy: string | null
  }
  client: {
    id: string
    name: string
    slug: string | null
  } | null
}

export type AssignedTaskSummaryResult = {
  items: AssignedTaskSummary[]
  totalCount: number
}

const DEFAULT_LIMIT = 12

const STATUS_PRIORITY_SQL = sql`
  CASE
    WHEN ${tasksTable.status} = 'BLOCKED' THEN 0
    WHEN ${tasksTable.status} = 'IN_PROGRESS' THEN 1
    WHEN ${tasksTable.status} = 'ON_DECK' THEN 2
    WHEN ${tasksTable.status} = 'DONE' THEN 3
    WHEN ${tasksTable.status} = 'ARCHIVED' THEN 4
    ELSE 999
  END
`

type FetchAssignedTasksSummaryOptions = {
  userId: string
  limit?: number | null
  includeCompletedStatuses?: boolean
}

async function loadAssignedTaskSummaries({
  userId,
  limit = DEFAULT_LIMIT,
  includeCompletedStatuses = true,
}: FetchAssignedTasksSummaryOptions): Promise<AssignedTaskSummaryResult> {
  const normalizedLimit =
    typeof limit === 'number' && Number.isFinite(limit)
      ? Math.max(1, limit)
      : limit === null
        ? null
        : DEFAULT_LIMIT

  const baseConditions = [
    eq(taskAssigneesTable.userId, userId),
    isNull(taskAssigneesTable.deletedAt),
    isNull(tasksTable.deletedAt),
    isNull(projectsTable.deletedAt),
    isNull(tasksTable.acceptedAt),
    ne(tasksTable.status, 'ARCHIVED'),
  ]

  if (!includeCompletedStatuses) {
    baseConditions.push(ne(tasksTable.status, 'DONE'))
  }

  const whereClause = and(...baseConditions)

  const orderExpressions = [
    sql`CASE WHEN ${taskAssigneeMetadataTable.sortOrder} IS NULL THEN 1 ELSE 0 END`,
    asc(taskAssigneeMetadataTable.sortOrder),
    sql`CASE WHEN ${tasksTable.dueOn} IS NULL THEN 1 ELSE 0 END`,
    asc(tasksTable.dueOn),
    STATUS_PRIORITY_SQL,
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
        id: clientsTable.id,
        name: clientsTable.name,
        slug: clientsTable.slug,
      },
    })
    .from(taskAssigneesTable)
    .innerJoin(tasksTable, eq(taskAssigneesTable.taskId, tasksTable.id))
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
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
      ? await baseQuery.limit(normalizedLimit)
      : await baseQuery

  // An unbounded query already returned every match — counting again
  // would repeat the full three-table join for a number we have.
  let totalCount = rows.length
  if (normalizedLimit !== null) {
    const totalResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(taskAssigneesTable)
      .innerJoin(tasksTable, eq(taskAssigneesTable.taskId, tasksTable.id))
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(whereClause)

    totalCount = Number(totalResult[0]?.count ?? 0)
  }

  const items: AssignedTaskSummary[] = rows.map(row => {
    const updatedSource = row.updatedAt ?? row.createdAt ?? null

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      status: row.status,
      dueOn: row.dueOn ?? null,
      updatedAt: updatedSource,
      sortOrder: row.sortOrder ?? null,
      project: {
        id: row.project.id,
        name: row.project.name,
        slug: row.project.slug ?? null,
        type: row.project.type as ProjectTypeValue,
        createdBy: row.project.createdBy ?? null,
      },
      client: row.client?.id
        ? {
            id: row.client.id,
            name: row.client.name ?? 'Unnamed client',
            slug: row.client.slug ?? null,
          }
        : null,
    }
  })

  return { items, totalCount }
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
 * Resolve a task's project without hydrating any project graph — used by
 * the My Tasks deep-link path to merge in a project outside the assigned
 * set. Soft-deleted tasks resolve to null (matches the previous behavior
 * of searching active task arrays only).
 */
export async function getActiveTaskProjectId(
  taskId: string
): Promise<string | null> {
  const rows = await db
    .select({ projectId: tasksTable.projectId })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), isNull(tasksTable.deletedAt)))
    .limit(1)

  return rows[0]?.projectId ?? null
}
