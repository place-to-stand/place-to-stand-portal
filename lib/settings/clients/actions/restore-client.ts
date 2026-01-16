import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientRestoredEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { CONVEX_FLAGS } from '@/lib/feature-flags'
import {
  restoreClientSchema,
  type RestoreClientInput,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'

export async function restoreClientMutation(
  context: ClientMutationContext,
  input: RestoreClientInput
): Promise<ClientMutationResult> {
  const parsed = restoreClientSchema.safeParse(input)

  if (!parsed.success) {
    return buildMutationResult({ error: 'Invalid restore request.' })
  }

  return trackSettingsServerInteraction(
    {
      entity: 'client',
      mode: 'restore',
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
        return restoreClientInConvex(context, parsed.data.id)
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
        console.error('Failed to load client for restore', error)
        return buildMutationResult({ error: 'Unable to restore client.' })
      }

      if (!existingClient) {
        return buildMutationResult({ error: 'Client not found.' })
      }

      if (!existingClient.deletedAt) {
        return buildMutationResult({ error: 'Client is already active.' })
      }

      try {
        await db
          .update(clients)
          .set({ deletedAt: null })
          .where(eq(clients.id, parsed.data.id))
      } catch (error) {
        console.error('Failed to restore client', error)
        return buildMutationResult({
          error:
            error instanceof Error ? error.message : 'Unable to restore client.',
        })
      }

      const event = clientRestoredEvent({ name: existingClient.name })

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
 * Restore client using dual-write (Supabase + Convex)
 *
 * During migration, we write to BOTH databases. Supabase is the
 * source of truth, Convex sync is best-effort.
 */
async function restoreClientInConvex(
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
    console.error('Failed to load client for restore', error)
    return buildMutationResult({ error: 'Unable to restore client.' })
  }

  if (!existingClient) {
    return buildMutationResult({ error: 'Client not found.' })
  }

  if (!existingClient.deletedAt) {
    return buildMutationResult({ error: 'Client is already active.' })
  }

  // 2. Restore in Supabase (source of truth)
  try {
    await db
      .update(clients)
      .set({ deletedAt: null })
      .where(eq(clients.id, clientId))
  } catch (error) {
    console.error('Failed to restore client in Supabase', error)
    return buildMutationResult({
      error: error instanceof Error ? error.message : 'Unable to restore client.',
    })
  }

  // 3. Also restore in Convex (best-effort)
  try {
    const { restoreClientInConvex: convexRestore } = await import(
      '@/lib/data/clients/convex'
    )
    await convexRestore(clientId)

    // Validate dual-write consistency
    // Fetch updated client from Supabase to get all fields
    const [restoredClient] = await db
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

    if (restoredClient) {
      const { validateClientDualWrite } = await import('@/lib/data/dual-write-validator')
      await validateClientDualWrite(
        {
          id: restoredClient.id,
          name: restoredClient.name,
          slug: restoredClient.slug,
          billingType: restoredClient.billingType,
          notes: restoredClient.notes,
          deletedAt: restoredClient.deletedAt ? new Date(restoredClient.deletedAt) : null,
        },
        clientId
      )
    }
  } catch (convexError) {
    // Log but don't fail - Supabase is source of truth
    console.error('Failed to sync client restore to Convex (non-fatal)', convexError)
  }

  // 4. Log activity
  const event = clientRestoredEvent({ name: existingClient.name })

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
