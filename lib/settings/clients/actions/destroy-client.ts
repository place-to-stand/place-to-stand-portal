import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientDeletedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { clientMembers, clients } from '@/lib/db/schema'
import { CONVEX_FLAGS } from '@/lib/feature-flags'
import {
  countHourBlocksForClient,
  countProjectsForClient,
} from '@/lib/queries/clients'
import {
  destroyClientSchema,
  type DestroyClientInput,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'

export async function destroyClientMutation(
  context: ClientMutationContext,
  input: DestroyClientInput
): Promise<ClientMutationResult> {
  const parsed = destroyClientSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({ error: 'Invalid permanent delete request.' })
  }

  return trackSettingsServerInteraction(
    {
      entity: 'client',
      mode: 'destroy',
      targetId: parsed.data.id,
    },
    async () => {
      const { user } = context
      try {
        assertAdmin(user)
      } catch (error) {
        if (error instanceof Error) {
          return buildMutationResult({ error: error.message })
        }
        return buildMutationResult({ error: 'Admin privileges required.' })
      }

      // Use Convex if enabled
      if (CONVEX_FLAGS.CLIENTS) {
        return destroyClientInConvex(context, parsed.data.id)
      }

      // Supabase (default)
      let existingClient:
        | {
            id: string
            name: string
            deletedAt: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: clients.id,
            name: clients.name,
            deletedAt: clients.deletedAt,
          })
          .from(clients)
          .where(eq(clients.id, parsed.data.id))
          .limit(1)

        existingClient = rows[0]
      } catch (error) {
        console.error('Failed to load client for permanent delete', error)
        return buildMutationResult({
          error: 'Unable to permanently delete client.',
        })
      }

      if (!existingClient) {
        return buildMutationResult({ error: 'Client not found.' })
      }

      if (!existingClient.deletedAt) {
        return buildMutationResult({
          error: 'Archive the client before permanently deleting.',
        })
      }

      let projectCount = 0
      let hourBlockCount = 0

      try {
        ;[projectCount, hourBlockCount] = await Promise.all([
          countProjectsForClient(parsed.data.id),
          countHourBlocksForClient(parsed.data.id),
        ])
      } catch (error) {
        console.error(
          'Failed to check client dependencies before delete',
          error
        )
        return buildMutationResult({
          error: 'Unable to verify client dependencies.',
        })
      }

      const blockingResources: string[] = []

      if (projectCount > 0) {
        blockingResources.push('projects')
      }

      if (hourBlockCount > 0) {
        blockingResources.push('hour blocks')
      }

      if (blockingResources.length > 0) {
        const resourceSummary =
          blockingResources.length === 1
            ? blockingResources[0]
            : `${blockingResources.slice(0, -1).join(', ')} and ${
                blockingResources[blockingResources.length - 1]
              }`

        return buildMutationResult({
          error: `Cannot permanently delete this client while ${resourceSummary} reference it.`,
        })
      }

      try {
        await db
          .delete(clientMembers)
          .where(eq(clientMembers.clientId, parsed.data.id))
      } catch (error) {
        console.error(
          'Failed to remove client memberships before delete',
          error
        )
        return buildMutationResult({
          error: 'Unable to remove client memberships.',
        })
      }

      try {
        await db.delete(clients).where(eq(clients.id, parsed.data.id))
      } catch (error) {
        console.error('Failed to permanently delete client', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to permanently delete client.',
        })
      }

      const event = clientDeletedEvent({ name: existingClient.name })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'CLIENT',
        targetId: existingClient.id,
        targetClientId: existingClient.id,
        metadata: event.metadata,
      })

      return buildMutationResult({})
    }
  )
}

/**
 * Permanently delete client using dual-write (Supabase + Convex)
 *
 * During migration, we delete from BOTH databases. Supabase is the
 * source of truth, Convex sync is best-effort.
 */
async function destroyClientInConvex(
  context: ClientMutationContext,
  clientId: string
): Promise<ClientMutationResult> {
  const { user } = context

  // 1. Fetch existing client from Supabase
  let existingClient: { id: string; name: string; deletedAt: string | null } | undefined
  try {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1)

    existingClient = rows[0]
  } catch (error) {
    console.error('Failed to load client for permanent delete', error)
    return buildMutationResult({ error: 'Unable to permanently delete client.' })
  }

  if (!existingClient) {
    return buildMutationResult({ error: 'Client not found.' })
  }

  if (!existingClient.deletedAt) {
    return buildMutationResult({ error: 'Archive the client before permanently deleting.' })
  }

  // 2. Check for blocking resources in Supabase
  let projectCount = 0
  let hourBlockCount = 0

  try {
    ;[projectCount, hourBlockCount] = await Promise.all([
      countProjectsForClient(clientId),
      countHourBlocksForClient(clientId),
    ])
  } catch (error) {
    console.error('Failed to check client dependencies before delete', error)
    return buildMutationResult({ error: 'Unable to verify client dependencies.' })
  }

  const blockingResources: string[] = []
  if (projectCount > 0) blockingResources.push('projects')
  if (hourBlockCount > 0) blockingResources.push('hour blocks')

  if (blockingResources.length > 0) {
    const resourceSummary =
      blockingResources.length === 1
        ? blockingResources[0]
        : `${blockingResources.slice(0, -1).join(', ')} and ${blockingResources[blockingResources.length - 1]}`

    return buildMutationResult({
      error: `Cannot permanently delete this client while ${resourceSummary} reference it.`,
    })
  }

  // 3. Delete from Supabase (source of truth)
  try {
    await db.delete(clientMembers).where(eq(clientMembers.clientId, clientId))
  } catch (error) {
    console.error('Failed to remove client memberships before delete', error)
    return buildMutationResult({ error: 'Unable to remove client memberships.' })
  }

  try {
    await db.delete(clients).where(eq(clients.id, clientId))
  } catch (error) {
    console.error('Failed to permanently delete client in Supabase', error)
    return buildMutationResult({
      error: error instanceof Error ? error.message : 'Unable to permanently delete client.',
    })
  }

  // 4. Also delete from Convex (best-effort)
  try {
    const { destroyClientInConvex: convexDestroy } = await import('@/lib/data/clients/convex')
    await convexDestroy(clientId)
  } catch (convexError) {
    // Log but don't fail - Supabase is source of truth
    // Note: No validation needed for hard delete since the record is gone
    console.error('Failed to sync client destroy to Convex (non-fatal)', convexError)
  }

  // 5. Log activity
  const event = clientDeletedEvent({ name: existingClient.name })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'CLIENT',
    targetId: existingClient.id,
    targetClientId: existingClient.id,
    metadata: event.metadata,
  })

  return buildMutationResult({})
}
