import { billingOpenSql, wasClientCompany } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import { and, count, eq, inArray, sql } from 'drizzle-orm'

import { removeBilling } from '@/lib/companies/billing/periods'

import { logActivity } from '@/lib/activity/logger'
import { clientDeletedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import {
  billingTerms,
  clientUpdates,
  commissionTermClosers,
  commissionTerms,
  companies,
  invoices,
} from '@/lib/db/schema'
import {
  countHourBlocksForClient,
  countProjectsForClient,
} from '@/lib/queries/clients'
import {
  destroyClientSchema,
  type DestroyClientInput,
} from '@/lib/companies/billing/client-service'

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
            id: companies.id,
            name: clientNameSql,
            // Billing must have stopped (an archived company alone isn't enough).
            deletedAt: sql<string | null>`case when ${billingOpenSql()} then null else now()::text end`,
          })
          .from(companies)
          .where(and(wasClientCompany(), eq(companies.id, parsed.data.id)))
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
      let invoiceCount = 0
      let updateCount = 0

      try {
        ;[projectCount, hourBlockCount, invoiceCount, updateCount] =
          await Promise.all([
            countProjectsForClient(parsed.data.id),
            countHourBlocksForClient(parsed.data.id),
            db
              .select({ n: count() })
              .from(invoices)
              .where(eq(invoices.companyId, parsed.data.id))
              .then(rows => rows[0]?.n ?? 0),
            db
              .select({ n: count() })
              .from(clientUpdates)
              .where(eq(clientUpdates.companyId, parsed.data.id))
              .then(rows => rows[0]?.n ?? 0),
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

      if (invoiceCount > 0) {
        blockingResources.push('invoices')
      }

      if (updateCount > 0) {
        blockingResources.push('client updates')
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

      // Portal access is derived from the company's memberships, so a
      // deleted client simply drops out of client_portal_access.
      try {
        // Nothing billed references it: the company was never really billed,
        // so it stops being a client at all (the company itself stays) and
        // the terms made with it go too, so making it a client again starts
        // clean.
        await db.transaction(async tx => {
          const termIds = tx
            .select({ id: commissionTerms.id })
            .from(commissionTerms)
            .where(eq(commissionTerms.companyId, parsed.data.id))
          await tx
            .delete(commissionTermClosers)
            .where(inArray(commissionTermClosers.termId, termIds))
          await tx
            .delete(commissionTerms)
            .where(eq(commissionTerms.companyId, parsed.data.id))
          await tx
            .delete(billingTerms)
            .where(eq(billingTerms.companyId, parsed.data.id))
          await removeBilling(tx, parsed.data.id)
        })
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
        targetCompanyId: existingClient.id,
        metadata: event.metadata,
      })

      return buildMutationResult({})
    }
  )
}
