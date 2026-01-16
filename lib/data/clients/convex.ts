'use server'

/**
 * Convex client data operations
 *
 * This module provides server-side wrappers for Convex client queries/mutations.
 * Used when CONVEX_FLAGS.CLIENTS is enabled.
 *
 * Type mappings convert Convex documents to the existing Supabase-based types
 * for backward compatibility during migration.
 *
 * Note: Hour block data is still fetched from Supabase since it hasn't been
 * migrated to Convex yet.
 */

import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'
import { and, inArray, isNull, sql } from 'drizzle-orm'

import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { db } from '@/lib/db'
import { hourBlocks, timeLogs, projects } from '@/lib/db/schema'

// ============================================================
// TYPE MAPPINGS
// ============================================================

/**
 * Maps a Convex client document to the existing ClientDetail type
 *
 * Uses supabaseId as ID for PostgreSQL compatibility during migration.
 * Falls back to Convex _id for records created after migration.
 */
function mapConvexClientToClientDetail(client: Doc<'clients'>) {
  return {
    id: client.supabaseId ?? client._id,
    name: client.name,
    slug: client.slug ?? null,
    notes: client.notes ?? null,
    billingType: client.billingType,
    createdAt: new Date(client.createdAt).toISOString(),
    updatedAt: new Date(client.updatedAt).toISOString(),
    deletedAt: client.deletedAt ? new Date(client.deletedAt).toISOString() : null,
  }
}

type ClientWithProjectCounts = Doc<'clients'> & {
  projectCount: number
  activeProjectCount: number
  activeProjects: Array<{ id: string; name: string; slug: string | null }>
}

type HourMetrics = {
  totalHoursPurchased: number
  totalHoursUsed: number
  hoursRemaining: number
}

/**
 * Maps a Convex client with project counts to ClientWithMetrics type
 */
function mapConvexClientWithMetrics(
  client: ClientWithProjectCounts,
  hourMetrics: HourMetrics = { totalHoursPurchased: 0, totalHoursUsed: 0, hoursRemaining: 0 }
) {
  const base = mapConvexClientToClientDetail(client)
  return {
    ...base,
    projectCount: client.projectCount,
    activeProjectCount: client.activeProjectCount,
    activeProjects: client.activeProjects,
    totalHoursPurchased: hourMetrics.totalHoursPurchased,
    totalHoursUsed: hourMetrics.totalHoursUsed,
    hoursRemaining: hourMetrics.hoursRemaining,
  }
}

/**
 * Fetch hour block metrics from Supabase for a list of client IDs
 * Used during migration since hour blocks haven't been migrated to Convex yet
 */
async function fetchHourMetricsFromSupabase(
  clientIds: string[]
): Promise<Map<string, HourMetrics>> {
  if (clientIds.length === 0) {
    return new Map()
  }

  // Fetch total hours purchased per client
  const hourBlocksData = await db
    .select({
      clientId: hourBlocks.clientId,
      totalHoursPurchased: sql<number>`
        coalesce(sum(${hourBlocks.hoursPurchased}), 0)
      `.as('total_hours_purchased'),
    })
    .from(hourBlocks)
    .where(and(inArray(hourBlocks.clientId, clientIds), isNull(hourBlocks.deletedAt)))
    .groupBy(hourBlocks.clientId)

  const hourBlocksMap = new Map(
    hourBlocksData.map((hb) => [hb.clientId, Number(hb.totalHoursPurchased ?? 0)])
  )

  // Fetch total hours used per client (from time logs on their projects)
  const timeLogsData = await db
    .select({
      clientId: projects.clientId,
      totalHoursUsed: sql<number>`
        coalesce(sum(${timeLogs.hours}), 0)
      `.as('total_hours_used'),
    })
    .from(timeLogs)
    .innerJoin(projects, sql`${timeLogs.projectId} = ${projects.id}`)
    .where(
      and(
        inArray(projects.clientId, clientIds),
        isNull(timeLogs.deletedAt),
        isNull(projects.deletedAt)
      )
    )
    .groupBy(projects.clientId)

  const timeLogsMap = new Map(
    timeLogsData.map((tl) => [tl.clientId, Number(tl.totalHoursUsed ?? 0)])
  )

  // Build metrics map
  const metricsMap = new Map<string, HourMetrics>()
  for (const clientId of clientIds) {
    const totalHoursPurchased = hourBlocksMap.get(clientId) ?? 0
    const totalHoursUsed = timeLogsMap.get(clientId) ?? 0
    metricsMap.set(clientId, {
      totalHoursPurchased,
      totalHoursUsed,
      hoursRemaining: totalHoursPurchased - totalHoursUsed,
    })
  }

  return metricsMap
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Fetch all accessible clients for the current user
 */
export async function fetchClientsFromConvex() {
  try {
    const clients = await fetchQuery(
      api.clients.queries.list,
      {},
      { token: await convexAuthNextjsToken() }
    )

    return clients.map(mapConvexClientToClientDetail)
  } catch (error) {
    console.error('Failed to fetch clients from Convex:', error)
    throw new Error('Failed to fetch clients', { cause: error })
  }
}

/**
 * Fetch clients with project counts for dashboard
 *
 * Fetches client data from Convex, then enriches with hour metrics from Supabase
 * (since hour blocks haven't been migrated to Convex yet).
 */
export async function fetchClientsWithMetricsFromConvex() {
  try {
    const clients = await fetchQuery(
      api.clients.queries.listWithProjectCounts,
      {},
      { token: await convexAuthNextjsToken() }
    )

    // Get Supabase IDs for hour metrics lookup
    const clientIds = clients
      .map((c) => c.supabaseId)
      .filter((id): id is string => id !== undefined)

    // Fetch hour metrics from Supabase
    const hourMetricsMap = await fetchHourMetricsFromSupabase(clientIds)

    return clients.map((client) => {
      const hourMetrics = client.supabaseId
        ? hourMetricsMap.get(client.supabaseId)
        : undefined
      return mapConvexClientWithMetrics(client, hourMetrics)
    })
  } catch (error) {
    console.error('Failed to fetch clients with metrics from Convex:', error)
    throw new Error('Failed to fetch clients with metrics', { cause: error })
  }
}

/**
 * Fetch archived clients with project counts for archive management
 *
 * Fetches client data from Convex, then enriches with hour metrics from Supabase.
 */
export async function fetchArchivedClientsWithMetricsFromConvex() {
  try {
    const clients = await fetchQuery(
      api.clients.queries.listArchivedWithProjectCounts,
      {},
      { token: await convexAuthNextjsToken() }
    )

    // Get Supabase IDs for hour metrics lookup
    const clientIds = clients
      .map((c) => c.supabaseId)
      .filter((id): id is string => id !== undefined)

    // Fetch hour metrics from Supabase
    const hourMetricsMap = await fetchHourMetricsFromSupabase(clientIds)

    return clients.map((client) => {
      const hourMetrics = client.supabaseId
        ? hourMetricsMap.get(client.supabaseId)
        : undefined
      return mapConvexClientWithMetrics(client, hourMetrics)
    })
  } catch (error) {
    console.error('Failed to fetch archived clients from Convex:', error)
    throw new Error('Failed to fetch archived clients', { cause: error })
  }
}

/**
 * Fetch a client by ID
 */
export async function fetchClientByIdFromConvex(clientId: string) {
  try {
    // Convert string ID to Convex ID type
    // During migration, clientId might be a Supabase UUID
    // Convex queries handle supabaseId lookup internally
    const client = await fetchQuery(
      api.clients.queries.getById,
      { clientId: clientId as Id<'clients'> },
      { token: await convexAuthNextjsToken() }
    )

    if (!client) {
      return null
    }

    return mapConvexClientToClientDetail(client)
  } catch (error) {
    console.error(`Failed to fetch client ${clientId} from Convex:`, error)
    throw new Error(`Failed to fetch client ${clientId}`, { cause: error })
  }
}

/**
 * Fetch a client by slug
 */
export async function fetchClientBySlugFromConvex(slug: string) {
  try {
    const client = await fetchQuery(
      api.clients.queries.getBySlug,
      { slug },
      { token: await convexAuthNextjsToken() }
    )

    if (!client) {
      return null
    }

    return mapConvexClientToClientDetail(client)
  } catch (error) {
    console.error(`Failed to fetch client by slug "${slug}" from Convex:`, error)
    throw new Error(`Failed to fetch client by slug "${slug}"`, { cause: error })
  }
}

/**
 * Fetch members of a client
 */
export async function fetchClientMembersFromConvex(clientId: string) {
  try {
    const members = await fetchQuery(
      api.clients.queries.getMembers,
      { clientId: clientId as Id<'clients'> },
      { token: await convexAuthNextjsToken() }
    )

    return members.map((user) => ({
      id: user.supabaseId ?? user._id,
      email: user.email,
      fullName: user.fullName ?? null,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: new Date(user.createdAt).toISOString(),
      updatedAt: new Date(user.updatedAt).toISOString(),
      deletedAt: user.deletedAt ? new Date(user.deletedAt).toISOString() : null,
    }))
  } catch (error) {
    console.error(`Failed to fetch members for client ${clientId} from Convex:`, error)
    throw new Error(`Failed to fetch client members for ${clientId}`, { cause: error })
  }
}

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new client
 *
 * During dual-write migration, accepts optional supabaseId for ID mapping.
 */
export async function createClientInConvex(input: {
  name: string
  slug?: string
  billingType: 'prepaid' | 'net_30'
  notes?: string
  supabaseId?: string // For dual-write migration
}) {
  const clientId = await fetchMutation(
    api.clients.mutations.create,
    {
      name: input.name,
      slug: input.slug,
      billingType: input.billingType,
      notes: input.notes,
      supabaseId: input.supabaseId,
    },
    { token: await convexAuthNextjsToken() }
  )

  return clientId
}

/**
 * Update a client
 */
export async function updateClientInConvex(
  clientId: string,
  input: {
    name?: string
    slug?: string
    billingType?: 'prepaid' | 'net_30'
    notes?: string
  }
) {
  await fetchMutation(
    api.clients.mutations.update,
    {
      clientId, // Now accepts string (Convex ID or Supabase UUID)
      ...input,
    },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Archive a client (soft delete)
 */
export async function archiveClientInConvex(clientId: string) {
  await fetchMutation(
    api.clients.mutations.archive,
    { clientId }, // Now accepts string (Convex ID or Supabase UUID)
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Restore an archived client
 */
export async function restoreClientInConvex(clientId: string) {
  await fetchMutation(
    api.clients.mutations.restore,
    { clientId }, // Now accepts string (Convex ID or Supabase UUID)
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Permanently delete a client (hard delete)
 */
export async function destroyClientInConvex(clientId: string) {
  await fetchMutation(
    api.clients.mutations.destroy,
    { clientId }, // Accepts string (Convex ID or Supabase UUID)
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Add a member to a client
 *
 * Accepts Supabase UUIDs - the Convex mutation resolves them internally.
 */
export async function addClientMemberInConvex(clientId: string, userId: string) {
  await fetchMutation(
    api.clients.mutations.addMember,
    {
      clientId, // String - Convex resolves by supabaseId if not a valid Convex ID
      userId, // String - Convex resolves by supabaseId if not a valid Convex ID
    },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Remove a member from a client
 *
 * Accepts Supabase UUIDs - the Convex mutation resolves them internally.
 */
export async function removeClientMemberInConvex(clientId: string, userId: string) {
  await fetchMutation(
    api.clients.mutations.removeMember,
    {
      clientId, // String - Convex resolves by supabaseId if not a valid Convex ID
      userId, // String - Convex resolves by supabaseId if not a valid Convex ID
    },
    { token: await convexAuthNextjsToken() }
  )
}
