import { billingOpenSql, wasClientCompany } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import { and, eq, sql } from 'drizzle-orm'

import {
  BillingPeriodError,
  stopBilling,
  type BillingEffective,
} from '@/lib/companies/billing/periods'

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
import { revokeCompanyPortalAccess } from '@/lib/companies/billing/revoke-company-portal-access'
import {
  deleteClientSchema,
  type DeleteClientInput,
} from '@/lib/companies/billing/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Stops a client's billing inside the caller's transaction (this month or
 * after it) and switches off its people's portal access, so a restart
 * doesn't silently bring it back. Returns the access trail to log once the
 * transaction committed.
 */
export async function stopClientBillingInTx(
  tx: DbTransaction,
  input: { companyId: string; effective: BillingEffective }
): Promise<ContactClientLinkChange[]> {
  await stopBilling(tx, input)
  return revokeCompanyPortalAccess(tx, input.companyId, input.companyId)
}

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
            billingOpen: boolean
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: companies.id,
            name: clientNameSql,
            companyId: companies.id,
            billingOpen: sql<boolean>`${billingOpenSql()}`,
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
      if (!existingClient.billingOpen) {
        return buildMutationResult({ error: 'Billing has already stopped.' })
      }

      const archived = existingClient
      let accessChanges: ContactClientLinkChange[] = []
      try {
        accessChanges = await db.transaction(tx =>
          stopClientBillingInTx(tx, {
            companyId: archived.companyId ?? archived.id,
            effective: parsed.data.effective ?? 'current_month',
          })
        )
      } catch (error) {
        if (!(error instanceof BillingPeriodError)) {
          console.error('Failed to archive client', error)
        }
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
        targetType: 'COMPANY',
        targetId: existingClient.id,
        targetCompanyId: existingClient.id,
        metadata: event.metadata,
      })

      return buildMutationResult({})
    }
  )
}
