import { and, eq, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { clientCreatedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { companies, leads } from '@/lib/db/schema'
import type { ClientBillingTypeValue } from '@/lib/types'
import { insertInitialBillingTerm } from '@/lib/queries/clients/billing-terms'
import { insertInitialCommissionTerm } from '@/lib/queries/clients/commission-terms'
import type { CloserShare } from '@/lib/companies/billing/closers'
import {
  assertClientPartnerUserRoles,
  generateUniqueClientSlug,
  toClientSlug,
} from '@/lib/companies/billing/client-service'

import {
  buildMutationResult,
  type ClientMutationContext,
  type ClientMutationResult,
} from './types'
import {
  fillCompanyWebsiteIfBlank,
  findOrCreateCompanyByName,
  getLinkableCompany,
} from '@/lib/queries/companies'

type CreateClientPayload = {
  name: string
  providedSlug: string | null
  billingType: ClientBillingTypeValue
  state: string | null
  /**
   * Deprecated: the company owns the website. Fills the client's company
   * website when it has none; never stored on the client.
   */
  website?: string | null
  originationContactId: string | null
  originationUserId: string | null
  closers: CloserShare[]
  notes: string | null
  /** The client's company; null finds or creates one named after the client. */
  companyId?: string | null
  /** Deprecated and ignored: a company has one client. */
  label?: string | null
}

const INSERT_RETRY_LIMIT = 3

export async function createClient(
  context: ClientMutationContext,
  payload: CreateClientPayload
): Promise<ClientMutationResult> {
  const { user } = context
  assertAdmin(user)
  const {
    name,
    providedSlug,
    billingType,
    state,
    website,
    originationContactId,
    originationUserId,
    closers,
    companyId: requestedCompanyId,
  } = payload

  const partnerRoleError = await assertClientPartnerUserRoles({
    originationUserId,
    closers,
  })
  if (partnerRoleError) {
    return buildMutationResult(partnerRoleError)
  }

  // Every client is a company.
  let companyId: string | null = null
  if (requestedCompanyId) {
    const company = await getLinkableCompany(requestedCompanyId)
    if (!company) {
      return buildMutationResult({ error: 'That company no longer exists.' })
    }
    companyId = company.id
  } else {
    // Company names are capped at 160 characters; a longer client name
    // gets a company with its first 160.
    const company = await findOrCreateCompanyByName(
      user,
      name.trim().slice(0, 160),
      {
        website,
      }
    )
    companyId = company?.id ?? null
  }
  // A client is a company's billing record, so it always has one.
  if (!companyId) {
    return buildMutationResult({ error: 'Unable to find or create the company.' })
  }
  await fillCompanyWebsiteIfBlank(user, companyId, website)

  // A company is a client once: a former client restarts billing instead.
  const [current] = await db
    .select({
      clientSince: companies.clientSince,
      clientEndedAt: companies.clientEndedAt,
      slug: companies.slug,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)
  if (current?.clientSince && !current.clientEndedAt) {
    return buildMutationResult({ error: 'That company is already a client.' })
  }
  if (current?.clientSince) {
    return buildMutationResult({
      error: 'That company was a client: restart its billing instead.',
    })
  }

  const baseSlug = providedSlug
    ? toClientSlug(providedSlug)
    : toClientSlug(name)
  // Keep a slug it already has (its project URLs use it).
  let slugCandidate =
    current?.slug ?? (await generateUniqueClientSlug(baseSlug))
  let attempt = 0

  while (attempt < INSERT_RETRY_LIMIT) {
    try {
      // Client + initial billing + commission terms are atomic: a client
      // without a terms row is invisible to every monthly close. A slug unique-violation
      // aborts the transaction and the loop retries with a fresh slug.
      const clientId = await db.transaction(async tx => {
        // A client is the company, billed: it gets a slug, its state, and a
        // start date (`client_since`).
        const now = new Date().toISOString()
        const made = await tx
          .update(companies)
          .set({
            slug: slugCandidate,
            state,
            clientSince: now,
            clientEndedAt: null,
            updatedAt: now,
          })
          .where(and(eq(companies.id, companyId), isNull(companies.clientSince)))
          .returning({ id: companies.id })

        const insertedId = made[0]?.id

        if (!insertedId) {
          return null
        }

        await insertInitialBillingTerm(tx, {
          clientId: insertedId,
          billingType,
          createdBy: user.id,
        })

        // Same atomicity for the commission split (PRD 007): the client's
        // first month must resolve its closers/origination.
        await insertInitialCommissionTerm(tx, {
          clientId: insertedId,
          closers,
          originationUserId,
          originationContactId,
          createdBy: user.id,
        })

        // Won leads at this company are converted: it became the client.
        await tx
          .update(leads)
          .set({ convertedAt: now })
          .where(
            and(
              eq(leads.companyId, companyId),
              eq(leads.status, 'CLOSED_WON'),
              isNull(leads.convertedAt),
              isNull(leads.deletedAt)
            )
          )

        return insertedId
      })

      if (!clientId) {
        console.error('Client created without returning identifier')
        return buildMutationResult({ error: 'Unable to create client.' })
      }

      const event = clientCreatedEvent({
        name,
        memberIds: [],
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'CLIENT',
        targetId: clientId,
        targetCompanyId: clientId,
        metadata: event.metadata,
      })

      return buildMutationResult({ clientId, slug: slugCandidate })
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}
