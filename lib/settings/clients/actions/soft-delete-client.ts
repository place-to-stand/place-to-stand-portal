import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientArchivedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { CONVEX_FLAGS } from '@/lib/feature-flags'
import {
  deleteClientSchema,
  type DeleteClientInput,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'

export async function softDeleteClientMutation(
  context: ClientMutationContext,
  input: DeleteClientInput
): Promise<ClientMutationResult> {
  const parsed = deleteClientSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({ error: 'Invalid delete request.' })
  }

  return trackSettingsServerInteraction(
    {
      entity: 'client',
      mode: 'delete',
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
        return archiveClientInConvex(context, parsed.data.id)
      }

      // Supabase (default)
      let existingClient:
        | {
            id: string
            name: string
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: clients.id,
            name: clients.name,
          })
          .from(clients)
          .where(eq(clients.id, parsed.data.id))
          .limit(1)

        existingClient = rows[0]
      } catch (error) {
        console.error('Failed to load client for archive', error)
        return buildMutationResult({ error: 'Unable to archive client.' })
      }

      if (!existingClient) {
        return buildMutationResult({ error: 'Client not found.' })
      }

      try {
        await db
          .update(clients)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(clients.id, parsed.data.id))
      } catch (error) {
        console.error('Failed to archive client', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to archive client.',
        })
      }

      const event = clientArchivedEvent({ name: existingClient.name })

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
 * Archive client using dual-write (Supabase + Convex)
 *
 * During migration, we write to BOTH databases. Supabase is the
 * source of truth, Convex sync is best-effort.
 */
async function archiveClientInConvex(
  context: ClientMutationContext,
  clientId: string
): Promise<ClientMutationResult> {
  const { user } = context

  // 1. Fetch existing client from Supabase
  let existingClient: { id: string; name: string } | undefined
  try {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1)

    existingClient = rows[0]
  } catch (error) {
    console.error('Failed to load client for archive', error)
    return buildMutationResult({ error: 'Unable to archive client.' })
  }

  if (!existingClient) {
    return buildMutationResult({ error: 'Client not found.' })
  }

  // 2. Archive in Supabase (source of truth)
  try {
    await db
      .update(clients)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(clients.id, clientId))
  } catch (error) {
    console.error('Failed to archive client in Supabase', error)
    return buildMutationResult({
      error: error instanceof Error ? error.message : 'Unable to archive client.',
    })
  }

  // 3. Also archive in Convex (best-effort)
  try {
    const { archiveClientInConvex: convexArchive } = await import(
      '@/lib/data/clients/convex'
    )
    await convexArchive(clientId)

    // Validate dual-write consistency
    // Fetch updated client from Supabase to get the deletedAt timestamp
    const [archivedClient] = await db
      .select({
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        billingType: clients.billingType,
        notes: clients.notes,
        deletedAt: clients.deletedAt,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1)

    if (archivedClient) {
      const { validateClientDualWrite } = await import('@/lib/data/dual-write-validator')
      await validateClientDualWrite(
        {
          id: archivedClient.id,
          name: archivedClient.name,
          slug: archivedClient.slug,
          billingType: archivedClient.billingType,
          notes: archivedClient.notes,
          deletedAt: archivedClient.deletedAt ? new Date(archivedClient.deletedAt) : null,
        },
        clientId
      )
    }
  } catch (convexError) {
    // Log but don't fail - Supabase is source of truth
    console.error('Failed to sync client archive to Convex (non-fatal)', convexError)
  }

  // 4. Log activity
  const event = clientArchivedEvent({ name: existingClient.name })

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
