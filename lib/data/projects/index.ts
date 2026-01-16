import 'server-only'

import { cache } from 'react'
import { and, eq, isNull } from 'drizzle-orm'

import type { AppUser, UserRole } from '@/lib/auth/session'
import { ensureClientAccessByProjectId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import { CONVEX_FLAGS } from '@/lib/feature-flags'
import type { ProjectWithRelations } from '@/lib/types'

import { getTimeLogSummariesForProjects } from '@/lib/queries/time-logs'
import { assembleProjectsWithRelations } from './assemble-projects'
import { fetchBaseProjects } from './fetch-base-projects'
import { fetchProjectRelations } from './fetch-project-relations'
export { fetchProjectCalendarTasks } from './fetch-project-calendar-tasks'

// ============================================================
// CONVEX INTEGRATION (lazy loaded)
// ============================================================

/**
 * Lazy import for Convex project functions to avoid loading when not needed
 */
async function getConvexProjects() {
  const convexModule = await import('./convex')
  return convexModule
}

// ============================================================
// TYPES
// ============================================================

export type ProjectDetail = {
  id: string
  name: string
  slug: string | null
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  status: 'ONBOARDING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
  clientId: string | null
  startsOn: string | null
  endsOn: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type FetchProjectsWithRelationsOptions = {
  forUserId?: string
  forRole?: UserRole
}

export const fetchProjectsWithRelations = cache(
  async (
    options: FetchProjectsWithRelationsOptions = {}
  ): Promise<ProjectWithRelations[]> => {
    const baseProjects = await fetchBaseProjects()

    const shouldScopeToUser =
      options.forRole !== 'ADMIN' && Boolean(options.forUserId)

    const relations = await fetchProjectRelations({
      projectIds: baseProjects.projectIds,
      clientIds: baseProjects.clientIds,
      shouldScopeToUser,
      userId: options.forUserId,
    })

    const timeLogSummaries = await getTimeLogSummariesForProjects(
      baseProjects.projectIds
    )

    return assembleProjectsWithRelations({
      projects: baseProjects.projects,
      projectClientLookup: baseProjects.projectClientLookup,
      options,
      shouldScopeToUser,
      relations,
      timeLogSummaries,
    })
  }
)

export async function fetchProjectsWithRelationsByIds(
  projectIds: string[]
): Promise<ProjectWithRelations[]> {
  if (!projectIds.length) {
    return []
  }

  const baseProjects = await fetchBaseProjects(projectIds)
  const relations = await fetchProjectRelations({
    projectIds: baseProjects.projectIds,
    clientIds: baseProjects.clientIds,
    shouldScopeToUser: false,
  })

  const timeLogSummaries = await getTimeLogSummariesForProjects(
    baseProjects.projectIds
  )

  return assembleProjectsWithRelations({
    projects: baseProjects.projects,
    projectClientLookup: baseProjects.projectClientLookup,
    options: {},
    shouldScopeToUser: false,
    relations,
    timeLogSummaries,
  })
}

// ============================================================
// SIMPLE PROJECT LOOKUPS (with Convex branching)
// ============================================================

/**
 * Fetch a project by ID
 *
 * Uses Convex when CONVEX_FLAGS.PROJECTS is enabled.
 */
export const fetchProjectById = cache(
  async (user: AppUser, projectId: string): Promise<ProjectDetail> => {
    // Use Convex if enabled
    if (CONVEX_FLAGS.PROJECTS) {
      try {
        const { fetchProjectByIdFromConvex } = await getConvexProjects()
        const project = await fetchProjectByIdFromConvex(projectId)
        if (!project) {
          throw new NotFoundError('Project not found')
        }
        return project
      } catch (error) {
        // Re-throw NotFoundError, handle others
        if (error instanceof NotFoundError) throw error
        console.error('Failed to fetch project from Convex', error)
        // Fall through to Supabase on error during migration
      }
    }

    // Supabase (default)
    await ensureClientAccessByProjectId(user, projectId)

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        type: projects.type,
        status: projects.status,
        clientId: projects.clientId,
        startsOn: projects.startsOn,
        endsOn: projects.endsOn,
        createdBy: projects.createdBy,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        deletedAt: projects.deletedAt,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)

    if (!rows.length) {
      throw new NotFoundError('Project not found')
    }

    return rows[0]
  }
)

/**
 * Fetch a project by slug
 *
 * Uses Convex when CONVEX_FLAGS.PROJECTS is enabled.
 */
export const fetchProjectBySlug = cache(
  async (user: AppUser, slug: string): Promise<ProjectDetail> => {
    // Use Convex if enabled
    if (CONVEX_FLAGS.PROJECTS) {
      try {
        const { fetchProjectBySlugFromConvex } = await getConvexProjects()
        const project = await fetchProjectBySlugFromConvex(slug)
        if (!project) {
          throw new NotFoundError('Project not found')
        }
        return project
      } catch (error) {
        // Re-throw NotFoundError, handle others
        if (error instanceof NotFoundError) throw error
        console.error('Failed to fetch project by slug from Convex', error)
        // Fall through to Supabase on error during migration
      }
    }

    // Supabase (default) - First, find the project by slug
    const projectRow = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
      .limit(1)

    if (!projectRow.length) {
      throw new NotFoundError('Project not found')
    }

    // Then fetch full details with permission check
    return fetchProjectById(user, projectRow[0].id)
  }
)

/**
 * Resolves a project identifier (slug or UUID) to the project record.
 * Returns the project detail if found, throws NotFoundError otherwise.
 */
export const resolveProjectIdentifier = cache(
  async (
    user: AppUser,
    identifier: string
  ): Promise<ProjectDetail & { resolvedId: string }> => {
    // Check if identifier looks like a UUID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      )

    let project: ProjectDetail

    if (isUUID) {
      project = await fetchProjectById(user, identifier)
    } else {
      project = await fetchProjectBySlug(user, identifier)
    }

    return { ...project, resolvedId: project.id }
  }
)
