import { clientNameSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin, ensureProjectAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, projects, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import { PAGE_SIZE_LIMITS } from '@/lib/pagination/page-size'
import { clampLimit, createSearchPattern } from '@/lib/pagination/cursor'
import {
  DEFAULT_PROJECTS_SORT,
  type ProjectSortField,
} from './sort'

import {
  projectFields,
  type ListProjectsForSettingsInput,
  projectGroupByColumns,
  projectSelection,
  type ProjectClientSummary,
  type ProjectOwnerSummary,
  type ProjectSelectionResult,
  type ProjectsSettingsListItem,
  type ProjectsSettingsResult,
  type SelectProject,
} from './listing-helpers'

export async function getProjectById(
  user: AppUser,
  projectId: string,
): Promise<SelectProject> {
  await ensureProjectAccess(user, projectId)

  const result = await db
    .select(projectFields)
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Project not found')
  }

  return result[0]
}


// PRD 004 §03 (R5): per-sort order expressions for the settings/archive list.
type ProjectSortDescriptor = {
  orderAsc: SQL
  orderDesc: SQL
}

const PROJECT_SORT_DESCRIPTORS: Record<ProjectSortField, ProjectSortDescriptor> = {
  name: {
    orderAsc: sql`${projects.name} ASC`,
    orderDesc: sql`${projects.name} DESC`,
  },
  created: {
    orderAsc: sql`${projects.createdAt} ASC`,
    orderDesc: sql`${projects.createdAt} DESC`,
  },
}

export async function listProjectsForSettings(
  user: AppUser,
  input: ListProjectsForSettingsInput = {},
): Promise<ProjectsSettingsResult> {
  assertAdmin(user)

  const limit = clampLimit(input.limit, PAGE_SIZE_LIMITS)
  const offset = Math.max(0, Math.floor(input.offset ?? 0))
  const normalizedStatus = input.status === 'archived' ? 'archived' : 'active'
  const searchQuery = input.search?.trim() ?? ''

  const statusCondition: SQL =
    normalizedStatus === 'active'
      ? sql`${projects.deletedAt} IS NULL`
      : sql`${projects.deletedAt} IS NOT NULL`

  const baseConditions: SQL[] = [statusCondition]

  if (searchQuery) {
    const pattern = createSearchPattern(searchQuery)
    baseConditions.push(
      sql`(${projects.name} ILIKE ${pattern} OR ${projects.slug} ILIKE ${pattern})`,
    )
  }

  const sort = input.sort ?? DEFAULT_PROJECTS_SORT
  const descriptor = PROJECT_SORT_DESCRIPTORS[sort.field]

  const whereClause =
    baseConditions.length > 0 ? and(...baseConditions) : undefined

  // Offset paging (page numbers + total, like every other list). The id
  // tiebreaker keeps page boundaries stable when sort values collide.
  const ordering =
    sort.direction === 'asc'
      ? [descriptor.orderAsc, asc(projects.id)]
      : [descriptor.orderDesc, desc(projects.id)]

  const rawRows = await db
    .select({
      project: projectSelection,
      client: {
        id: clients.id,
        name: clientNameSql,
        deletedAt: clients.deletedAt,
      },
      owner: {
        id: users.id,
        fullName: personNameSql,
        email: users.email,
      },
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(users, eq(projects.createdBy, users.id))
    .where(whereClause)
    .groupBy(...projectGroupByColumns)
    .orderBy(...ordering)
    .limit(limit)
    .offset(offset)

  const rows = rawRows as Array<{
    project: ProjectSelectionResult
    client: ProjectClientSummary | null
    owner: ProjectOwnerSummary | null
  }>

  const mappedItems: ProjectsSettingsListItem[] = rows.map(row => ({
    ...row.project,
    client: row.project.clientId
      ? row.client && row.client.id
        ? {
            id: row.client.id,
            name: row.client.name,
            deletedAt: row.client.deletedAt,
          }
        : null
      : null,
    owner: row.owner
      ? {
          id: row.owner.id,
          fullName: row.owner.fullName,
          email: row.owner.email,
        }
      : row.project.createdBy
          ? {
              id: row.project.createdBy,
              fullName: null,
              email: null,
            }
          : null,
  }))

  const [totalResult, unfilteredTotalResult, clientDirectory] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(baseConditions.length ? and(...baseConditions) : undefined),
    // Status-scoped only — the `M` in `Showing N of M` (PRD 004 §03).
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(statusCondition),
    db
      .select({
        id: clients.id,
        name: clientNameSql,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .orderBy(asc(clientNameSql)),
  ])

  const totalCount = Number(totalResult[0]?.count ?? 0)
  const unfilteredTotalCount = Number(unfilteredTotalResult[0]?.count ?? 0)
  return {
    items: mappedItems,
    totalCount,
    unfilteredTotalCount,
    clients: clientDirectory.map(client => ({
      id: client.id,
      name: client.name,
      deletedAt: client.deletedAt,
    })),
  }
}

export type {
  ListProjectsForSettingsInput,
  
  ProjectsSettingsListItem,
  ProjectsSettingsResult,
  SelectProject,
} from './listing-helpers'

