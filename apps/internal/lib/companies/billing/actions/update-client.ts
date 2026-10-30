import { wasClientCompany } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import { and, eq } from 'drizzle-orm'

import { currentBillingTypeSql } from '@/lib/queries/clients/billing-terms'
import { formatCalendarDate } from '@pts/ui/dates'

import { logActivity } from '@/lib/activity/logger'
import { clientUpdatedEvent } from '@/lib/activity/events'
import type { AppUser, UserRole } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import type { ClientBillingTypeValue } from '@/lib/types'
import { isMonthClosed } from '@/lib/data/reports/close'
import {
  currentMonthStartUtc,
  nextMonthStartUtc,
  upsertBillingTerm,
} from '@/lib/queries/clients/billing-terms'
import {
  commissionAssignmentsEqual,
  fetchLatestClosersByClient,
  resolveClosers,
  currentOriginationContactIdSql,
  currentOriginationUserIdSql,
  upsertCommissionTerm,
} from '@/lib/queries/clients/commission-terms'
import {
  closerSplitsEqual,
  describeClosers,
  type ClientCloser,
  type CloserShare,
} from '@/lib/companies/billing/closers'
import {
  assertClientPartnerUserRoles,
  clientSlugExists,
  toClientSlug,
} from '@/lib/companies/billing/client-service'

import { getLinkableCompany } from '@/lib/queries/companies'

export type UpdateClientPayload = {
  id: string
  name: string
  providedSlug: string | null
  billingType: ClientBillingTypeValue
  /** Month boundary the report basis switches at when billingType changes. */
  billingEffective: 'current_month' | 'next_month'
  /** Month boundary the Monthly Close switches closer/origination at. */
  commissionEffective: 'current_month' | 'next_month'
  state: string | null
  /**
   * Deprecated: the company owns the website. Fills the client's company
   * website when it has none; the client's legacy copy is left as is.
   */
  website?: string | null
  originationContactId: string | null
  originationUserId: string | null
  closers: CloserShare[]
  notes: string | null
  /** Omitted keeps the client's company; null unlinks it. */
  companyId?: string | null
  /** Deprecated and ignored: a company has one client. */
  label?: string | null
}

export class ClosedMonthError extends Error {
  constructor(effectiveFrom: string) {
    const label = formatCalendarDate(effectiveFrom, {
      month: 'long',
      year: 'numeric',
    })
    super(
      `That month's books are closed. Reopen ${label} before changing its billing or commission basis.`
    )
    this.name = 'ClosedMonthError'
  }
}

export type ExistingClientRecord = {
  id: string
  name: string
  slug: string | null
  billingType: ClientBillingTypeValue
  notes: string | null
  originationContactId: string | null
  originationUserId: string | null
  /** The newest commission term's closers — the saved split the sheet edited. */
  closers: ClientCloser[]
  companyId: string | null
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** A checked billing edit, ready to write in a transaction. */
export type ClientUpdatePlan = {
  id: string
  name: string
  notes: string | null
  state: string | null
  slugToUpdate: string | null
  billingType: ClientBillingTypeValue
  /** Set when the billing type changes: the month the new term starts. */
  billingEffectiveFrom: string | null
  commission: {
    closers: CloserShare[]
    originationUserId: string | null
    originationContactId: string | null
  }
  /** Set when closers or origination change: the month the new term starts. */
  commissionEffectiveFrom: string | null
  existingClient: ExistingClientRecord
  companyId: string | null | undefined
}

/**
 * Checks a billing edit (partner roles, slug) and works out which terms it
 * writes, before any write.
 */
export async function planClientUpdate(
  user: AppUser,
  payload: UpdateClientPayload
): Promise<{ plan: ClientUpdatePlan } | { error: string }> {
  assertAdmin(user)
  const {
    id,
    name,
    providedSlug,
    billingType,
    billingEffective,
    commissionEffective,
    state,
    originationContactId,
    originationUserId,
    closers,
    notes,
    companyId,
  } = payload

  if (companyId && !(await getLinkableCompany(companyId))) {
    return { error: 'That company no longer exists.' }
  }

  const partnerRoleError = await assertClientPartnerUserRoles({
    originationUserId,
    closers,
  })
  if (partnerRoleError) return partnerRoleError

  const slugToUpdate = providedSlug ? toClientSlug(providedSlug) : null

  if (slugToUpdate && slugToUpdate.length < 3) {
    return { error: 'Slug must be at least 3 characters.' }
  }

  if (slugToUpdate) {
    const exists = await clientSlugExists(slugToUpdate, { excludeId: id })
    if (exists) return { error: 'Another client already uses this slug.' }
  }

  let existingClient: ExistingClientRecord | undefined = undefined

  try {
    const rows = await db
      .select({
        id: companies.id,
        name: clientNameSql,
        slug: companies.slug,
        billingType: currentBillingTypeSql(),
        notes: companies.notes,
        originationContactId: currentOriginationContactIdSql(),
        originationUserId: currentOriginationUserIdSql(),
        companyId: companies.id,
      })
      .from(companies)
      .where(and(wasClientCompany(), eq(companies.id, id)))
      .limit(1)

    const closersByClient = rows[0]
      ? await fetchLatestClosersByClient([id])
      : null
    existingClient = rows[0]
      ? { ...rows[0], closers: closersByClient?.get(id) ?? [] }
      : undefined
  } catch (error) {
    console.error('Failed to load client for update', error)
    return { error: 'Unable to update client.' }
  }

  if (!existingClient) return { error: 'Client not found.' }

  const billingTypeChanged = existingClient.billingType !== billingType
  const billingEffectiveFrom = billingTypeChanged
    ? billingEffective === 'current_month'
      ? currentMonthStartUtc()
      : nextMonthStartUtc()
    : null

  // Closers + origination are one logical "commission split" (PRD 007): any
  // change to either writes one effective-dated term so closed months keep
  // resolving to the assignment they were paid under.
  const commission = { closers, originationUserId, originationContactId }
  const commissionChanged = !commissionAssignmentsEqual(
    existingClient,
    commission
  )
  const commissionEffectiveFrom = commissionChanged
    ? commissionEffective === 'current_month'
      ? currentMonthStartUtc()
      : nextMonthStartUtc()
    : null

  return {
    plan: {
      id,
      name,
      notes,
      state,
      slugToUpdate,
      billingType,
      billingEffectiveFrom,
      commission,
      commissionEffectiveFrom,
      existingClient,
      companyId,
    },
  }
}

/**
 * Writes a planned billing edit inside the caller's transaction. A change
 * dated into a month whose books are closed throws `ClosedMonthError`.
 */
export async function applyClientUpdateInTx(
  tx: DbTransaction,
  plan: ClientUpdatePlan,
  actorId: string
): Promise<void> {
  const { id } = plan
  if (plan.billingEffectiveFrom) {
    // Guard inside the transaction — a check-then-write outside it would
    // let a concurrent close slip between the check and the term upsert.
    if (await isMonthClosed(plan.billingEffectiveFrom)) {
      throw new ClosedMonthError(plan.billingEffectiveFrom)
    }
    await upsertBillingTerm(tx, {
      companyId: id,
      billingType: plan.billingType,
      effectiveFrom: plan.billingEffectiveFrom,
      createdBy: actorId,
    })
  }

  if (plan.commissionEffectiveFrom) {
    if (await isMonthClosed(plan.commissionEffectiveFrom)) {
      throw new ClosedMonthError(plan.commissionEffectiveFrom)
    }
    await upsertCommissionTerm(tx, {
      companyId: id,
      effectiveFrom: plan.commissionEffectiveFrom,
      ...plan.commission,
      createdBy: actorId,
    })
  }

  // Billing type and commission are stored only as terms (above): displays
  // read the newest term, and effective_from controls report resolution.
  await tx
    .update(companies)
    .set({
      slug: plan.slugToUpdate,
      state: plan.state,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(companies.id, id))
}

/** A billing edit's activity row, written once its transaction committed. */
export async function logClientUpdate(
  user: AppUser,
  plan: ClientUpdatePlan
): Promise<void> {
  await recordUpdateActivity({
    userContext: { id: user.id, role: user.role },
    existingClient: plan.existingClient,
    updatedValues: {
      name: plan.name,
      notes: plan.notes,
      slugToUpdate: plan.slugToUpdate,
      billingType: plan.billingType,
      billingEffectiveFrom: plan.billingEffectiveFrom,
      commissionEffectiveFrom: plan.commissionEffectiveFrom,
      ...plan.commission,
      companyId:
        plan.companyId === undefined
          ? plan.existingClient.companyId
          : plan.companyId,
    },
  })
}

type RecordUpdateActivityArgs = {
  userContext: {
    id: string
    role: UserRole
  }
  existingClient: ExistingClientRecord
  updatedValues: {
    name: string
    notes: string | null
    slugToUpdate: string | null
    billingType: ClientBillingTypeValue
    billingEffectiveFrom: string | null
    commissionEffectiveFrom: string | null
    originationContactId: string | null
    originationUserId: string | null
    closers: CloserShare[]
    companyId: string | null
  }
}

type ClientDiff = {
  changedFields: string[]
  previousDetails: Record<string, unknown>
  nextDetails: Record<string, unknown>
  memberChanges?: {
    added: string[]
    removed: string[]
  }
}

async function recordUpdateActivity(args: RecordUpdateActivityArgs) {
  const diff = await calculateDiff(args)

  if (diff.changedFields.length === 0) {
    return
  }

  const { userContext, existingClient } = args
  const detailsPayload =
    Object.keys(diff.previousDetails).length > 0 ||
    Object.keys(diff.nextDetails).length > 0
      ? { before: diff.previousDetails, after: diff.nextDetails }
      : undefined

  const event = clientUpdatedEvent({
    name: args.updatedValues.name,
    changedFields: diff.changedFields,
    memberChanges: diff.memberChanges,
    details: detailsPayload,
  })

  await logActivity({
    actorId: userContext.id,
    actorRole: userContext.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'COMPANY',
    targetId: existingClient.id,
    targetCompanyId: existingClient.id,
    metadata: event.metadata,
  })
}

async function calculateDiff({
  existingClient,
  updatedValues,
}: Omit<RecordUpdateActivityArgs, 'userContext'>): Promise<ClientDiff> {
  const changedFields: string[] = []
  const previousDetails: Record<string, unknown> = {}
  const nextDetails: Record<string, unknown> = {}

  if (existingClient.name !== updatedValues.name) {
    changedFields.push('name')
    previousDetails.name = existingClient.name
    nextDetails.name = updatedValues.name
  }

  const previousSlug = existingClient.slug ?? null
  const nextSlug = updatedValues.slugToUpdate ?? null

  if (previousSlug !== nextSlug) {
    changedFields.push('slug')
    previousDetails.slug = previousSlug
    nextDetails.slug = nextSlug
  }

  if (existingClient.companyId !== updatedValues.companyId) {
    changedFields.push('company')
    previousDetails.companyId = existingClient.companyId
    nextDetails.companyId = updatedValues.companyId
  }

  const previousNotes = existingClient.notes ?? null
  const nextNotes = updatedValues.notes ?? null

  if (previousNotes !== nextNotes) {
    changedFields.push('notes')
    previousDetails.notes = previousNotes
    nextDetails.notes = nextNotes
  }

  const previousBillingType = existingClient.billingType
  const nextBillingType = updatedValues.billingType

  if (previousBillingType !== nextBillingType) {
    changedFields.push('billing type')
    previousDetails.billingType = previousBillingType
    nextDetails.billingType = nextBillingType
    // Month boundary the report basis switches at (the cache flips at save).
    nextDetails.billingTypeEffectiveFrom = updatedValues.billingEffectiveFrom
  }

  // Origination — treat both sides (user + contact) as a single logical
  // field for the activity feed. Any change to either one surfaces as
  // "origination".
  const previousOriginationUserId = existingClient.originationUserId ?? null
  const nextOriginationUserId = updatedValues.originationUserId ?? null
  const previousOriginationContactId =
    existingClient.originationContactId ?? null
  const nextOriginationContactId = updatedValues.originationContactId ?? null

  if (
    previousOriginationUserId !== nextOriginationUserId ||
    previousOriginationContactId !== nextOriginationContactId
  ) {
    changedFields.push('origination')
    previousDetails.originationUserId = previousOriginationUserId
    previousDetails.originationContactId = previousOriginationContactId
    nextDetails.originationUserId = nextOriginationUserId
    nextDetails.originationContactId = nextOriginationContactId
    nextDetails.commissionEffectiveFrom = updatedValues.commissionEffectiveFrom
  }

  if (!closerSplitsEqual(existingClient.closers, updatedValues.closers)) {
    changedFields.push('closers')
    // Names, not ids: a split is a list with shares, which the feed's
    // single-user field kind can't render. Captured at save time.
    previousDetails.closers = describeClosersOrNone(existingClient.closers)
    nextDetails.closers = describeClosersOrNone(
      await resolveClosers(updatedValues.closers)
    )
    // Month boundary the Monthly Close switches at (the cache flips at save).
    nextDetails.commissionEffectiveFrom = updatedValues.commissionEffectiveFrom
  }

  return {
    changedFields,
    previousDetails,
    nextDetails,
  }
}

function describeClosersOrNone(closers: ClientCloser[]): string {
  return closers.length > 0 ? describeClosers(closers) : 'None'
}
