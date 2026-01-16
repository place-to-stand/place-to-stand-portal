'use server'

/**
 * Convex project data operations
 *
 * This module provides server-side wrappers for Convex project queries/mutations.
 * Used when CONVEX_FLAGS.PROJECTS is enabled.
 *
 * Type mappings convert Convex documents to the existing Supabase-based types
 * for backward compatibility during migration.
 */

import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'

import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'

// ============================================================
// TYPE MAPPINGS
// ============================================================

/**
 * Base project detail type matching the existing Supabase type structure
 */
export type ProjectDetailFromConvex = {
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

/**
 * Maps a Convex project document to the existing ProjectDetail type
 *
 * Uses supabaseId as ID for PostgreSQL compatibility during migration.
 * Falls back to Convex _id for records created after migration.
 */
function mapConvexProjectToDetail(project: Doc<'projects'>): ProjectDetailFromConvex {
  return {
    id: project.supabaseId ?? project._id,
    name: project.name,
    slug: project.slug ?? null,
    type: project.type,
    status: project.status,
    // Note: This returns the Convex clientId as-is. Callers that need Supabase UUIDs
    // for downstream queries should resolve client IDs separately (see fetchAllProjectsFromConvex).
    clientId: project.clientId ?? null,
    startsOn: project.startsOn ?? null,
    endsOn: project.endsOn ?? null,
    createdBy: project.createdBy ? project.createdBy : null,
    createdAt: new Date(project.createdAt).toISOString(),
    updatedAt: new Date(project.updatedAt).toISOString(),
    deletedAt: project.deletedAt ? new Date(project.deletedAt).toISOString() : null,
  }
}

type ProjectWithTaskCounts = Doc<'projects'> & {
  taskCount: number
  doneTaskCount: number
}

/**
 * Maps a Convex project with task counts
 */
function mapConvexProjectWithTaskCounts(project: ProjectWithTaskCounts) {
  const base = mapConvexProjectToDetail(project)
  return {
    ...base,
    taskCount: project.taskCount,
    doneTaskCount: project.doneTaskCount,
  }
}

type ProjectWithClient = Doc<'projects'> & {
  client: Doc<'clients'> | null
}

/**
 * Maps a Convex project with client info
 */
function mapConvexProjectWithClient(project: ProjectWithClient) {
  const base = mapConvexProjectToDetail(project)
  return {
    ...base,
    client: project.client
      ? {
          id: project.client.supabaseId ?? project.client._id,
          name: project.client.name,
          slug: project.client.slug ?? null,
        }
      : null,
  }
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Fetch all accessible projects for the current user
 */
export async function fetchProjectsFromConvex(): Promise<ProjectDetailFromConvex[]> {
  try {
    const projects = await fetchQuery(
      api.projects.queries.list,
      {},
      { token: await convexAuthNextjsToken() }
    )

    return projects.map(mapConvexProjectToDetail)
  } catch (error) {
    console.error('Failed to fetch projects from Convex:', error)
    throw new Error('Failed to fetch projects', { cause: error })
  }
}

/**
 * Fetch projects by type
 */
export async function fetchProjectsByTypeFromConvex(
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
): Promise<ProjectDetailFromConvex[]> {
  try {
    const projects = await fetchQuery(
      api.projects.queries.listByType,
      { type },
      { token: await convexAuthNextjsToken() }
    )

    return projects.map(mapConvexProjectToDetail)
  } catch (error) {
    console.error(`Failed to fetch ${type} projects from Convex:`, error)
    throw new Error(`Failed to fetch ${type} projects`, { cause: error })
  }
}

/**
 * Fetch projects for a specific client
 */
export async function fetchProjectsByClientFromConvex(
  clientId: string
): Promise<ProjectDetailFromConvex[]> {
  try {
    // During migration, clientId might be a Supabase UUID
    // We need to resolve it to a Convex ID first
    const projects = await fetchQuery(
      api.projects.queries.listByClient,
      { clientId: clientId as Id<'clients'> },
      { token: await convexAuthNextjsToken() }
    )

    return projects.map(mapConvexProjectToDetail)
  } catch (error) {
    console.error(`Failed to fetch projects for client ${clientId} from Convex:`, error)
    throw new Error(`Failed to fetch projects for client ${clientId}`, { cause: error })
  }
}

/**
 * Fetch a project by ID
 */
export async function fetchProjectByIdFromConvex(
  projectId: string
): Promise<ProjectDetailFromConvex | null> {
  try {
    const project = await fetchQuery(
      api.projects.queries.getById,
      { projectId: projectId as Id<'projects'> },
      { token: await convexAuthNextjsToken() }
    )

    if (!project) {
      return null
    }

    return mapConvexProjectToDetail(project)
  } catch (error) {
    console.error(`Failed to fetch project ${projectId} from Convex:`, error)
    throw new Error(`Failed to fetch project ${projectId}`, { cause: error })
  }
}

/**
 * Fetch a project by slug
 */
export async function fetchProjectBySlugFromConvex(
  slug: string
): Promise<ProjectDetailFromConvex | null> {
  try {
    const project = await fetchQuery(
      api.projects.queries.getBySlug,
      { slug },
      { token: await convexAuthNextjsToken() }
    )

    if (!project) {
      return null
    }

    return mapConvexProjectToDetail(project)
  } catch (error) {
    console.error(`Failed to fetch project by slug "${slug}" from Convex:`, error)
    throw new Error(`Failed to fetch project by slug "${slug}"`, { cause: error })
  }
}

/**
 * Fetch a project by slug with client info
 */
export async function fetchProjectBySlugWithClientFromConvex(slug: string) {
  try {
    const project = await fetchQuery(
      api.projects.queries.getBySlugWithClient,
      { slug },
      { token: await convexAuthNextjsToken() }
    )

    if (!project) {
      return null
    }

    return mapConvexProjectWithClient(project as ProjectWithClient)
  } catch (error) {
    console.error(`Failed to fetch project by slug "${slug}" with client from Convex:`, error)
    throw new Error(`Failed to fetch project by slug "${slug}" with client`, { cause: error })
  }
}

/**
 * Fetch projects with task counts
 */
export async function fetchProjectsWithTaskCountsFromConvex() {
  try {
    const projects = await fetchQuery(
      api.projects.queries.listWithTaskCounts,
      {},
      { token: await convexAuthNextjsToken() }
    )

    return projects.map(mapConvexProjectWithTaskCounts)
  } catch (error) {
    console.error('Failed to fetch projects with task counts from Convex:', error)
    throw new Error('Failed to fetch projects with task counts', { cause: error })
  }
}

/**
 * Fetch archived projects
 */
export async function fetchArchivedProjectsFromConvex(): Promise<ProjectDetailFromConvex[]> {
  try {
    const projects = await fetchQuery(
      api.projects.queries.listArchived,
      {},
      { token: await convexAuthNextjsToken() }
    )

    return projects.map(mapConvexProjectToDetail)
  } catch (error) {
    console.error('Failed to fetch archived projects from Convex:', error)
    throw new Error('Failed to fetch archived projects', { cause: error })
  }
}

/**
 * Fetch projects for a client with task counts
 *
 * Used by the client detail page.
 */
export async function fetchProjectsForClientFromConvex(clientId: string) {
  try {
    const projects = await fetchQuery(
      api.projects.queries.listForClientWithTaskCounts,
      { clientId },
      { token: await convexAuthNextjsToken() }
    )

    return projects.map((project) => ({
      id: project.supabaseId ?? project._id,
      name: project.name,
      slug: project.slug ?? null,
      status: project.status,
      type: project.type,
      startsOn: project.startsOn ?? null,
      endsOn: project.endsOn ?? null,
      totalTasks: project.totalTasks,
      doneTasks: project.doneTasks,
    }))
  } catch (error) {
    console.error(`Failed to fetch projects for client ${clientId} from Convex:`, error)
    throw new Error(`Failed to fetch projects for client ${clientId}`, { cause: error })
  }
}

/**
 * Fetch all accessible projects (base data only)
 *
 * Used by fetchBaseProjects to get project data from Convex.
 * Returns projects in the format expected by the assembly functions.
 *
 * IMPORTANT: This function resolves Convex IDs to Supabase UUIDs
 * for compatibility with downstream Supabase queries (e.g., hour blocks, time logs)
 * and for user ID comparisons (e.g., filtering PERSONAL projects by created_by).
 */
export async function fetchAllProjectsFromConvex() {
  try {
    const projects = await fetchQuery(
      api.projects.queries.list,
      {},
      { token: await convexAuthNextjsToken() }
    )

    // Collect unique client IDs (Convex IDs) that need to be resolved to Supabase UUIDs
    const convexClientIds = Array.from(
      new Set(
        projects
          .map((p) => p.clientId)
          .filter((id): id is Id<'clients'> => id !== undefined && id !== null)
      )
    )

    // Collect unique createdBy user IDs (Convex IDs) that need to be resolved to Supabase UUIDs
    const convexUserIds = Array.from(
      new Set(
        projects
          .map((p) => p.createdBy)
          .filter((id): id is Id<'users'> => id !== undefined && id !== null)
      )
    )

    // Build a map from Convex client ID to Supabase UUID
    const clientIdMap = new Map<string, string>()

    if (convexClientIds.length > 0) {
      // Fetch clients to get their supabaseIds
      const clients = await fetchQuery(
        api.clients.queries.getByIds,
        { clientIds: convexClientIds },
        { token: await convexAuthNextjsToken() }
      )

      // Map Convex _id to supabaseId (or fall back to _id if no supabaseId)
      for (const client of clients) {
        clientIdMap.set(client._id, client.supabaseId ?? client._id)
      }
    }

    // Build a map from Convex user ID to Supabase UUID
    const userIdMap = new Map<string, string>()

    if (convexUserIds.length > 0) {
      // Fetch users to get their supabaseIds
      const users = await fetchQuery(
        api.users.queries.getByIds,
        { userIds: convexUserIds },
        { token: await convexAuthNextjsToken() }
      )

      // Map Convex _id to supabaseId (or fall back to _id if no supabaseId)
      for (const user of users) {
        userIdMap.set(user._id, user.supabaseId ?? user._id)
      }
    }

    // Map to DbProject format for compatibility with existing assembly code
    return projects.map((project) => ({
      id: project.supabaseId ?? project._id,
      name: project.name,
      status: project.status,
      type: project.type,
      // Resolve client Convex ID to Supabase UUID for downstream compatibility
      client_id: project.clientId ? (clientIdMap.get(project.clientId) ?? null) : null,
      slug: project.slug ?? null,
      starts_on: project.startsOn ?? null,
      ends_on: project.endsOn ?? null,
      created_at: new Date(project.createdAt).toISOString(),
      updated_at: new Date(project.updatedAt).toISOString(),
      deleted_at: project.deletedAt ? new Date(project.deletedAt).toISOString() : null,
      // Resolve createdBy Convex ID to Supabase UUID for user comparison compatibility
      created_by: project.createdBy ? (userIdMap.get(project.createdBy) ?? null) : null,
    }))
  } catch (error) {
    console.error('Failed to fetch all projects from Convex:', error)
    throw new Error('Failed to fetch all projects', { cause: error })
  }
}

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new project
 *
 * During dual-write migration, accepts optional supabaseId for ID mapping.
 */
export async function createProjectInConvex(input: {
  name: string
  slug?: string
  type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
  status: 'ONBOARDING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
  clientId?: string | null
  startsOn?: string | null
  endsOn?: string | null
  supabaseId?: string // For dual-write migration
}) {
  const projectId = await fetchMutation(
    api.projects.mutations.create,
    {
      name: input.name,
      slug: input.slug,
      type: input.type,
      status: input.status,
      clientId: input.clientId ?? undefined,
      startsOn: input.startsOn ?? undefined,
      endsOn: input.endsOn ?? undefined,
      supabaseId: input.supabaseId,
    },
    { token: await convexAuthNextjsToken() }
  )

  return projectId
}

/**
 * Update a project
 */
export async function updateProjectInConvex(
  projectId: string,
  input: {
    name?: string
    slug?: string | null
    type?: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
    status?: 'ONBOARDING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
    clientId?: string | null
    startsOn?: string | null
    endsOn?: string | null
  }
) {
  // Convert null to undefined for optional fields that don't accept null in Convex
  // clientId, startsOn, endsOn can be null (to clear the field)
  await fetchMutation(
    api.projects.mutations.update,
    {
      projectId, // Accepts string (Convex ID or Supabase UUID)
      name: input.name,
      slug: input.slug ?? undefined, // Convex expects string | undefined, not null
      type: input.type,
      status: input.status,
      clientId: input.clientId, // This one accepts null to clear the field
      startsOn: input.startsOn, // This one accepts null to clear the field
      endsOn: input.endsOn, // This one accepts null to clear the field
    },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Archive a project (soft delete)
 */
export async function archiveProjectInConvex(projectId: string) {
  await fetchMutation(
    api.projects.mutations.archive,
    { projectId }, // Accepts string (Convex ID or Supabase UUID)
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Restore an archived project
 */
export async function restoreProjectInConvex(projectId: string) {
  await fetchMutation(
    api.projects.mutations.restore,
    { projectId }, // Accepts string (Convex ID or Supabase UUID)
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Permanently delete a project (hard delete)
 */
export async function destroyProjectInConvex(projectId: string) {
  await fetchMutation(
    api.projects.mutations.destroy,
    { projectId }, // Accepts string (Convex ID or Supabase UUID)
    { token: await convexAuthNextjsToken() }
  )
}
