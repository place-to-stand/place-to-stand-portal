import { eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientArchivedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import {
  logContactClientLinkChanges,
  type ContactClientLinkChange,
} from '@/lib/queries/contacts/settings/contact-client-link-activity'
import { revokeCompanyPortalAccess } from '@/lib/settings/clients/revoke-company-portal-access'
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

      let existingClient:
        | {
            id: string
            name: string
            companyId: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: clients.id,
            name: clients.name,
            companyId: clients.companyId,
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

      const archived = existingClient
      let accessChanges: ContactClientLinkChange[] = []
      try {
        await db.transaction(async tx => {
          await tx
            .update(clients)
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(clients.id, parsed.data.id))
          // An archived client grants nobody access; switch it off so a
          // restore (or another client at the company) doesn't bring it back.
          if (archived.companyId) {
            accessChanges = await revokeCompanyPortalAccess(
              tx,
              archived.companyId,
              archived.id
            )
          }
        })
      } catch (error) {
        console.error('Failed to archive client', error)
        return buildMutationResult({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to archive client.',
        })
      }

      await logContactClientLinkChanges(user, accessChanges)

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
