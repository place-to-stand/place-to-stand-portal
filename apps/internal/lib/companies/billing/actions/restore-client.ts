import { billingOpenSql, wasClientCompany } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import { and, eq, sql } from 'drizzle-orm'

import { BillingPeriodError, restartBilling } from '@/lib/companies/billing/periods'

import { logActivity } from '@/lib/activity/logger'
import { clientRestoredEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { companies, } from '@/lib/db/schema'
import {
  restoreClientSchema,
  type RestoreClientInput,
} from '@/lib/companies/billing/client-service'

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
            billingOpen: boolean
            companyArchived: string | null
          }
        | undefined

      try {
        const rows = await db
          .select({
            id: companies.id,
            name: clientNameSql,
            billingOpen: sql<boolean>`${billingOpenSql()}`,
            companyArchived: companies.deletedAt,
          })
          .from(companies)
          .where(and(wasClientCompany(), eq(companies.id, parsed.data.id)))
          .limit(1)

        existingClient = rows[0]
      } catch (error) {
        console.error('Failed to load client for restore', error)
        return buildMutationResult({ error: 'Unable to restore client.' })
      }

      if (!existingClient) {
        return buildMutationResult({ error: 'Client not found.' })
      }

      if (existingClient.billingOpen) {
        return buildMutationResult({ error: 'Client is already active.' })
      }

      // An archived company can't be billed: restore the company first.
      if (existingClient.companyArchived) {
        return buildMutationResult({
          error: 'Restore the company before restarting its billing.',
        })
      }

      try {
        await db.transaction(tx =>
          restartBilling(tx, {
            companyId: parsed.data.id,
            effective: parsed.data.effective ?? 'current_month',
            actorId: user.id,
          })
        )
      } catch (error) {
        if (!(error instanceof BillingPeriodError)) {
          console.error('Failed to restore client', error)
        }
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
        targetCompanyId: existingClient.id,
        metadata: event.metadata,
      })

      return buildMutationResult({})
    }
  )
}
