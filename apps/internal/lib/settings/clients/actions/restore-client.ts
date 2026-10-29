import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientRestoredEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { syncCompanyClientLinksTx } from '@/lib/queries/companies/people-links'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
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

      let existingClient:
        | {
            id: string
            name: string
            deletedAt: string | null
            companyId: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: clients.id,
            name: clients.name,
            deletedAt: clients.deletedAt,
            companyId: clients.companyId,
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

      // Restored, it takes its company's current people (and their portal
      // access), including anyone who joined while it was archived.
      const companyId = existingClient.companyId
      let linkChanges: ContactClientLinkChange[] = []
      try {
        await db.transaction(async tx => {
          await tx
            .update(clients)
            .set({ deletedAt: null })
            .where(eq(clients.id, parsed.data.id))
          linkChanges = await syncCompanyClientLinksTx(tx, [companyId])
        })
      } catch (error) {
        console.error('Failed to restore client', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to restore client.',
        })
      }

      await logContactClientLinkChanges(user, linkChanges)

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
