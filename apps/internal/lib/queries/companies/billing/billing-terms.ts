import 'server-only'

import { billingTypeAsOfSql } from '@pts/db/terms'

import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm'

import { db, type DbTx } from '@/lib/db'
import { billingTerms } from '@/lib/db/schema'
import type { ClientBillingTypeValue } from '@/lib/types'

type DbOrTransaction = typeof db | DbTx

import { currentMonthStartUtc } from '@/lib/billing/months'

export { currentMonthStartUtc, nextMonthStartUtc } from '@/lib/billing/months'

/**
 * Inserts a client's first billing term, effective its first billed month
 * (the billing period's `starts_on`), so a client starting next month has no
 * term in a month it isn't billed. Must run in the same transaction as the
 * billing start — a client without a terms row is invisible to every
 * monthly close.
 */
export async function insertInitialBillingTerm(
  tx: DbOrTransaction,
  params: {
    companyId: string
    billingType: ClientBillingTypeValue
    /** The first billed month ('yyyy-MM-01'). */
    effectiveFrom: string
    createdBy: string | null
  }
): Promise<void> {
  await tx.insert(billingTerms).values({
    companyId: params.companyId,
    billingType: params.billingType,
    effectiveFrom: params.effectiveFrom,
    createdBy: params.createdBy,
  })
}

/**
 * Inserts a term at a month boundary, or overwrites the billing type of the
 * existing active term at that boundary (re-editing a scheduled boundary
 * upserts rather than erroring). The unique index is partial, so the conflict
 * target must carry its predicate.
 */
export async function upsertBillingTerm(
  tx: DbOrTransaction,
  params: {
    companyId: string
    billingType: ClientBillingTypeValue
    effectiveFrom: string
    createdBy: string | null
  }
): Promise<void> {
  await tx
    .insert(billingTerms)
    .values({
      companyId: params.companyId,
      billingType: params.billingType,
      effectiveFrom: params.effectiveFrom,
      createdBy: params.createdBy,
    })
    .onConflictDoUpdate({
      target: [billingTerms.companyId, billingTerms.effectiveFrom],
      targetWhere: sql`deleted_at IS NULL`,
      set: {
        billingType: params.billingType,
        createdBy: params.createdBy,
        updatedAt: new Date().toISOString(),
      },
    })
}

/**
 * Resolves a client's billing type as of a given month start ('yyyy-MM-dd').
 */
async function resolveBillingTypeAsOf(
  companyId: string,
  periodStart: string,
  tx: DbOrTransaction = db
): Promise<ClientBillingTypeValue | null> {
  const [row] = await tx.execute<{
    billing_type: ClientBillingTypeValue | null
  }>(
    sql`select ${billingTypeAsOfSql(periodStart, sql`${companyId}::uuid`)} as billing_type`
  )
  return row?.billing_type ?? null
}

/**
 * Month a newly created hour block's hours are billed in (D13). Defaults to
 * the current month; when the client is still net_30-resolving with a prepaid
 * boundary ahead, clamps forward to that boundary so the block counts in the
 * first month it can actually be billed instead of being orphaned.
 */
export async function resolveHourBlockBillingMonth(
  companyId: string,
  tx: DbOrTransaction = db
): Promise<string> {
  const monthStart = currentMonthStartUtc()
  const current = await resolveBillingTypeAsOf(companyId, monthStart, tx)

  if (current === 'prepaid') {
    return monthStart
  }

  const [upcoming] = await tx
    .select({ effectiveFrom: billingTerms.effectiveFrom })
    .from(billingTerms)
    .where(
      and(
        eq(billingTerms.companyId, companyId),
        eq(billingTerms.billingType, 'prepaid'),
        gt(billingTerms.effectiveFrom, monthStart),
        isNull(billingTerms.deletedAt)
      )
    )
    .orderBy(asc(billingTerms.effectiveFrom))
    .limit(1)

  if (upcoming) {
    return upcoming.effectiveFrom
  }

  // Defensive: an hour block for a client with no prepaid term anywhere.
  // Attribute to the current month rather than failing the write.
  console.error(
    `[resolveHourBlockBillingMonth] Client ${companyId} has no prepaid billing term; attributing block to ${monthStart}`
  )
  return monthStart
}
