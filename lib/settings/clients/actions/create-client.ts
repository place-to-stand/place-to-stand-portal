import { logActivity } from '@/lib/activity/logger'
import { clientCreatedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { CONVEX_FLAGS } from '@/lib/feature-flags'
import type { ClientBillingTypeValue } from '@/lib/types'
import {
  generateUniqueClientSlug,
  syncClientMembers,
  toClientSlug,
} from '@/lib/settings/clients/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'

type CreateClientPayload = {
  name: string
  providedSlug: string | null
  billingType: ClientBillingTypeValue
  notes: string | null
  memberIds: string[]
}

const INSERT_RETRY_LIMIT = 3

export async function createClient(
  context: ClientMutationContext,
  payload: CreateClientPayload
): Promise<ClientMutationResult> {
  const { user } = context
  assertAdmin(user)
  const { name, providedSlug, billingType, notes, memberIds } = payload

  // Use Convex if enabled
  if (CONVEX_FLAGS.CLIENTS) {
    return createClientInConvex(context, payload)
  }

  // Supabase (default)
  const baseSlug = providedSlug
    ? toClientSlug(providedSlug)
    : toClientSlug(name)
  let slugCandidate = await generateUniqueClientSlug(baseSlug)
  let attempt = 0

  while (attempt < INSERT_RETRY_LIMIT) {
    try {
      const inserted = await db
        .insert(clients)
        .values({
          name,
          slug: slugCandidate,
          billingType,
          notes,
          createdBy: user.id,
        })
        .returning({ id: clients.id })

      const clientId = inserted[0]?.id

      if (!clientId) {
        console.error('Client created without returning identifier')
        return buildMutationResult({ error: 'Unable to create client.' })
      }

      const syncResult = await syncClientMembers(clientId, memberIds)

      if (syncResult.error) {
        console.error('Failed to sync client members after create', syncResult)
        return buildMutationResult(syncResult)
      }

      const event = clientCreatedEvent({
        name,
        memberIds,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'CLIENT',
        targetId: clientId,
        targetClientId: clientId,
        metadata: event.metadata,
      })

      return buildMutationResult({ clientId })
    } catch (error) {
      if (!isUniqueViolation(error)) {
        console.error('Failed to create client', error)
        return buildMutationResult({
          error:
            error instanceof Error ? error.message : 'Unable to create client.',
        })
      }

      slugCandidate = await generateUniqueClientSlug(baseSlug)
      attempt += 1
      continue
    }
  }

  return buildMutationResult({
    error: 'Could not generate a unique slug. Please try again.',
  })
}

/**
 * Create client using dual-write (Convex + Supabase)
 *
 * During migration, we write to BOTH databases to keep downstream
 * features (messages, etc.) working while they still use Supabase.
 */
async function createClientInConvex(
  context: ClientMutationContext,
  payload: CreateClientPayload
): Promise<ClientMutationResult> {
  const { user } = context
  const { name, providedSlug, billingType, notes, memberIds } = payload

  const baseSlug = providedSlug
    ? toClientSlug(providedSlug)
    : toClientSlug(name)
  const slugCandidate = await generateUniqueClientSlug(baseSlug)

  try {
    // 1. Write to Supabase first (source of truth for other features)
    const inserted = await db
      .insert(clients)
      .values({
        name,
        slug: slugCandidate,
        billingType,
        notes,
        createdBy: user.id,
      })
      .returning({ id: clients.id })

    const supabaseClientId = inserted[0]?.id

    if (!supabaseClientId) {
      console.error('Client created without returning identifier')
      return buildMutationResult({ error: 'Unable to create client.' })
    }

    // 2. Sync members to Supabase
    const syncResult = await syncClientMembers(supabaseClientId, memberIds)
    if (syncResult.error) {
      console.error('Failed to sync client members after create', syncResult)
      return buildMutationResult(syncResult)
    }

    // 3. Also write to Convex (async, don't block on failure)
    try {
      const { createClientInConvex: convexCreate, addClientMemberInConvex } =
        await import('@/lib/data/clients/convex')

      await convexCreate({
        name,
        slug: slugCandidate,
        billingType,
        notes: notes ?? undefined,
        supabaseId: supabaseClientId, // Pass Supabase ID for mapping
      })

      // Add members to Convex
      for (const memberId of memberIds) {
        try {
          await addClientMemberInConvex(supabaseClientId, memberId)
        } catch (memberError) {
          console.error('Failed to add member to client in Convex', memberError)
        }
      }

      // Validate dual-write consistency
      const { validateClientDualWrite } = await import('@/lib/data/dual-write-validator')
      await validateClientDualWrite(
        {
          id: supabaseClientId,
          name,
          slug: slugCandidate,
          billingType,
          notes,
          deletedAt: null,
        },
        supabaseClientId
      )
    } catch (convexError) {
      // Log but don't fail - Supabase is source of truth during migration
      console.error('Failed to sync client to Convex (non-fatal)', convexError)
    }

    // 4. Log activity
    const event = clientCreatedEvent({
      name,
      memberIds,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'CLIENT',
      targetId: supabaseClientId,
      targetClientId: supabaseClientId,
      metadata: event.metadata,
    })

    return buildMutationResult({ clientId: supabaseClientId })
  } catch (error) {
    console.error('Failed to create client', error)
    return buildMutationResult({
      error: error instanceof Error ? error.message : 'Unable to create client.',
    })
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}
