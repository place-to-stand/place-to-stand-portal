import { wasClientCompany } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import { and, eq } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientArchivedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { companies, } from '@/lib/db/schema'
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
            endedAt: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: companies.id,
            name: clientNameSql,
            companyId: companies.id,
            endedAt: companies.clientEndedAt,
          })
          .from(companies)
          .where(and(wasClientCompany(), eq(companies.id, parsed.data.id)))
          .limit(1)

        existingClient = rows[0]
      } catch (error) {
        console.error('Failed to load client for archive', error)
        return buildMutationResult({ error: 'Unable to archive client.' })
      }

      if (!existingClient) {
        return buildMutationResult({ error: 'Client not found.' })
      }

      // Stopping twice would move the date billing stopped.
      if (existingClient.endedAt) {
        return buildMutationResult({ error: 'Billing has already stopped.' })
      }

      const archived = existingClient
      let accessChanges: ContactClientLinkChange[] = []
      try {
        await db.transaction(async tx => {
          await tx
            .update(companies)
            .set({
              clientEndedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(companies.id, parsed.data.id))
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
        targetCompanyId: existingClient.id,
        metadata: event.metadata,
      })

      return buildMutationResult({})
    }
  )
}
