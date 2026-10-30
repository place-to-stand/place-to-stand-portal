import 'server-only'

import { and, asc, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm'

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
 * SQL fragment resolving a client's billing type as of a report period —
 * newest `effective_from` <= period start wins, mirroring how
 * `getPartnerRatesForPeriod` resolves the partner rate schedule. Correlated
 * against the outer `companies` table (written table-qualified, as drizzle
 * drops the table name from a column inside a selected fragment), so it is
 * only valid inside a query that reads `companies`.
 */
export function billingTypeAsOfSql(periodStart: string) {
  return sql<'prepaid' | 'net_30' | null>`(
    SELECT ${billingTerms.billingType}
    FROM ${billingTerms}
    WHERE ${billingTerms.companyId} = ${sql.raw('"companies"."id"')}
      AND ${billingTerms.effectiveFrom} <= ${periodStart}
      AND ${billingTerms.deletedAt} IS NULL
    ORDER BY ${billingTerms.effectiveFrom} DESC
    LIMIT 1
  )`
}

/**
 * Resolves a client's billing type as of a given month start ('yyyy-MM-dd').
 */
async function resolveBillingTypeAsOf(
  companyId: string,
  periodStart: string,
  tx: DbOrTransaction = db
): Promise<ClientBillingTypeValue | null> {
  const [row] = await tx
    .select({ billingType: billingTerms.billingType })
    .from(billingTerms)
    .where(
      and(
        eq(billingTerms.companyId, companyId),
        lte(billingTerms.effectiveFrom, periodStart),
        isNull(billingTerms.deletedAt)
      )
    )
    .orderBy(desc(billingTerms.effectiveFrom))
    .limit(1)

  return row?.billingType ?? null
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

/**
 * The client's billing type as the Billing tab last set it: the newest
 * billing term (latest effective date, so a change scheduled for next month
 * shows straight away, as it always has). This is the one place billing type
 * is stored; reports resolve by period with `billingTypeAsOfSql`. Correlated
 * against the outer `companies` table, written table-qualified because drizzle
 * drops the table name from a column inside a selected fragment.
 */
export function currentBillingTypeSql() {
  return sql<'prepaid' | 'net_30'>`coalesce((
    SELECT ${billingTerms.billingType}
    FROM ${billingTerms}
    WHERE ${billingTerms.companyId} = ${sql.raw('"companies"."id"')}
      AND ${billingTerms.deletedAt} IS NULL
    ORDER BY ${billingTerms.effectiveFrom} DESC
    LIMIT 1
  ), 'prepaid')`
}
