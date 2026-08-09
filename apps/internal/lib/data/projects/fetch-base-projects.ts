import { and, asc, eq, ilike, inArray, isNull, or } from 'drizzle-orm'

import type { ProjectStatusValue } from '@/lib/constants'
import { db } from '@/lib/db'
import { clients, projects } from '@/lib/db/schema'
import { createSearchPattern } from '@/lib/pagination/cursor'
import type { DbProject } from '@/lib/types'

export type BaseProjectFetchResult = {
  projects: DbProject[]
  projectIds: string[]
  clientIds: string[]
  ownerIds: string[]
  projectClientLookup: Map<string, string | null>
}

export type FetchBaseProjectsOptions = {
  projectIds?: string[]
  /**
   * Status predicate. Undefined = no status filtering; an empty array means
   * an explicitly cleared selection and matches nothing.
   */
  statuses?: ProjectStatusValue[]
  /** ILIKE search over project name/slug and the joined client name. */
  search?: string
}

const EMPTY_RESULT: BaseProjectFetchResult = {
  projects: [],
  projectIds: [],
  clientIds: [],
  ownerIds: [],
  projectClientLookup: new Map(),
}

export async function fetchBaseProjects(
  options: FetchBaseProjectsOptions = {}
): Promise<BaseProjectFetchResult> {
  const { projectIds: filterProjectIds, statuses, search } = options

  // Explicitly cleared status selection matches nothing.
  if (statuses && statuses.length === 0) {
    return EMPTY_RESULT
  }

  const conditions = [isNull(projects.deletedAt)]

  if (filterProjectIds?.length) {
    conditions.push(inArray(projects.id, filterProjectIds))
  }

  if (statuses?.length) {
    conditions.push(inArray(projects.status, statuses))
  }

  const trimmedSearch = search?.trim()
  if (trimmedSearch) {
    const pattern = createSearchPattern(trimmedSearch)
    const searchCondition = or(
      ilike(projects.name, pattern),
      ilike(projects.slug, pattern),
      ilike(clients.name, pattern)
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  const baseQuery = db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      type: projects.type,
      clientId: projects.clientId,
      slug: projects.slug,
      startsOn: projects.startsOn,
      endsOn: projects.endsOn,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      deletedAt: projects.deletedAt,
      createdBy: projects.createdBy,
      ownerId: projects.ownerId,
    })
    .from(projects)

  // Join clients only when searching — the client name is a search target.
  const rows = await (trimmedSearch
    ? baseQuery.leftJoin(clients, eq(projects.clientId, clients.id))
    : baseQuery
  )
    .where(and(...conditions))
    .orderBy(asc(projects.name))

  const normalizedProjects: DbProject[] = rows.map(row => ({
    id: row.id,
    name: row.name,
    status: row.status,
    type: row.type,
    client_id: row.clientId,
    slug: row.slug,
    starts_on: row.startsOn,
    ends_on: row.endsOn,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
    created_by: row.createdBy ?? null,
    owner_id: row.ownerId ?? null,
  }))

  const projectIds = normalizedProjects.map(project => project.id)
  const clientIds = Array.from(
    new Set(
      normalizedProjects
        .map(project => project.client_id)
        .filter((clientId): clientId is string => Boolean(clientId))
    )
  )
  const ownerIds = Array.from(
    new Set(
      normalizedProjects
        .map(project => project.owner_id)
        .filter((ownerId): ownerId is string => Boolean(ownerId))
    )
  )

  const projectClientLookup = new Map<string, string | null>()
  normalizedProjects.forEach(project => {
    projectClientLookup.set(project.id, project.client_id ?? null)
  })

  return {
    projects: normalizedProjects,
    projectIds,
    clientIds,
    ownerIds,
    projectClientLookup,
  }
}
