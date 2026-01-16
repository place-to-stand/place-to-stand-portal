import { and, asc, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { CONVEX_FLAGS } from '@/lib/feature-flags'
import type { DbProject } from '@/lib/types'

export type BaseProjectFetchResult = {
  projects: DbProject[]
  projectIds: string[]
  clientIds: string[]
  projectClientLookup: Map<string, string | null>
}

/**
 * Lazy import for Convex project functions
 */
async function getConvexProjects() {
  const convexModule = await import('./convex')
  return convexModule
}

export async function fetchBaseProjects(
  filterProjectIds?: string[]
): Promise<BaseProjectFetchResult> {
  // Use Convex if enabled (and not filtering by specific IDs, which isn't supported yet)
  if (CONVEX_FLAGS.PROJECTS && !filterProjectIds?.length) {
    try {
      const { fetchAllProjectsFromConvex } = await getConvexProjects()
      const convexProjects = await fetchAllProjectsFromConvex()

      // Map to DbProject format (fetchAllProjectsFromConvex already does this)
      const normalizedProjects: DbProject[] = convexProjects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        type: p.type,
        client_id: p.client_id,
        slug: p.slug,
        starts_on: p.starts_on,
        ends_on: p.ends_on,
        created_at: p.created_at,
        updated_at: p.updated_at,
        deleted_at: p.deleted_at,
        created_by: p.created_by,
      }))

      const projectIds = normalizedProjects.map((project) => project.id)
      const clientIds = Array.from(
        new Set(
          normalizedProjects
            .map((project) => project.client_id)
            .filter((clientId): clientId is string => Boolean(clientId))
        )
      )

      const projectClientLookup = new Map<string, string | null>()
      normalizedProjects.forEach((project) => {
        projectClientLookup.set(project.id, project.client_id ?? null)
      })

      return {
        projects: normalizedProjects,
        projectIds,
        clientIds,
        projectClientLookup,
      }
    } catch (error) {
      console.error('Failed to fetch projects from Convex, falling back to Supabase:', error)
      // Fall through to Supabase
    }
  }

  // Supabase fallback (or when filtering by specific IDs)
  const conditions = [isNull(projects.deletedAt)]

  if (filterProjectIds?.length) {
    conditions.push(inArray(projects.id, filterProjectIds))
  }

  const rows = await db
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
    })
    .from(projects)
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
  }))

  const projectIds = normalizedProjects.map(project => project.id)
  const clientIds = Array.from(
    new Set(
      normalizedProjects
        .map(project => project.client_id)
        .filter((clientId): clientId is string => Boolean(clientId))
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
    projectClientLookup,
  }
}
