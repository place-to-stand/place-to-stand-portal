import { and, eq, isNull, sql } from 'drizzle-orm'

import { billingOpenSql, wasClientCompany } from '@pts/db/client-state'

import { logActivity } from '@/lib/activity/logger'
import { clientCreatedEvent } from '@/lib/activity/events'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { companies, leads } from '@/lib/db/schema'
import type { ClientBillingTypeValue } from '@/lib/types'
import { insertInitialBillingTerm } from '@/lib/queries/clients/billing-terms'
import { startBilling, type BillingEffective } from '@/lib/companies/billing/periods'
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
  /** The first month billed: this month (default) or next. */
  startEffective?: BillingEffective
}

const INSERT_RETRY_LIMIT = 3

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Makes a company a client inside the caller's transaction: its slug and
 * state, a billing period from this month (or next), and its first billing
 * and commission terms (a client without terms is invisible to every
 * monthly close). Won leads at the company count as converted. A slug that
 * another company took meanwhile fails with a unique violation.
 */
export async function startClientBillingInTx(
  tx: DbTransaction,
  input: {
    companyId: string
    slug: string
    state: string | null
    billingType: ClientBillingTypeValue
    originationUserId: string | null
    originationContactId: string | null
    closers: CloserShare[]
    effective: BillingEffective
    actorId: string
  }
): Promise<void> {
  const { companyId } = input
  const now = new Date().toISOString()
  await tx
    .update(companies)
    .set({ slug: input.slug, state: input.state, updatedAt: now })
    .where(eq(companies.id, companyId))
  await startBilling(tx, {
    companyId,
    effective: input.effective,
    actorId: input.actorId,
  })
  await insertInitialBillingTerm(tx, {
    clientId: companyId,
    billingType: input.billingType,
    createdBy: input.actorId,
  })
  // Same atomicity for the commission split (PRD 007): the client's first
  // month must resolve its closers/origination.
  await insertInitialCommissionTerm(tx, {
    clientId: companyId,
    closers: input.closers,
    originationUserId: input.originationUserId,
    originationContactId: input.originationContactId,
    createdBy: input.actorId,
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
}

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
    startEffective,
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
      wasClient: sql<boolean>`${wasClientCompany()}`,
      billingOpen: sql<boolean>`${billingOpenSql()}`,
      slug: companies.slug,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)
  if (current?.billingOpen) {
    return buildMutationResult({ error: 'That company is already a client.' })
  }
  if (current?.wasClient) {
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
        await startClientBillingInTx(tx, {
          companyId,
          slug: slugCandidate,
          state,
          billingType,
          originationUserId,
          originationContactId,
          closers,
          effective: startEffective ?? 'current_month',
          actorId: user.id,
        })
        return companyId
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
        targetType: 'COMPANY',
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
