import 'server-only'

import { and, desc, eq, isNull } from 'drizzle-orm'

import { clientBillingPeriods } from '@pts/db/schema'

import type { db } from '@/lib/db'
import {
  currentMonthStartUtc,
  nextMonthStartUtc,
} from '@/lib/queries/clients/billing-terms'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Which month a start, stop or restart takes effect. */
export type BillingEffective = 'current_month' | 'next_month'

export class BillingPeriodError extends Error {}

function previousMonthStartUtc(): string {
  const now = new Date()
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return prev.toISOString().slice(0, 10)
}

function monthAfter(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
}

const monthOf = (effective: BillingEffective) =>
  effective === 'current_month' ? currentMonthStartUtc() : nextMonthStartUtc()

async function latestPeriod(tx: DbTransaction, companyId: string) {
  const [period] = await tx
    .select({
      id: clientBillingPeriods.id,
      startsOn: clientBillingPeriods.startsOn,
      endsOn: clientBillingPeriods.endsOn,
    })
    .from(clientBillingPeriods)
    .where(
      and(
        eq(clientBillingPeriods.companyId, companyId),
        isNull(clientBillingPeriods.deletedAt)
      )
    )
    .orderBy(desc(clientBillingPeriods.startsOn))
    .limit(1)
    // Two saves racing on one company serialize here.
    .for('update')
  return period ?? null
}

/** Make a company a client: billing starts this month or next. */
export async function startBilling(
  tx: DbTransaction,
  input: { companyId: string; effective: BillingEffective; actorId: string }
): Promise<{ startsOn: string }> {
  if (await latestPeriod(tx, input.companyId)) {
    throw new BillingPeriodError(
      'That company was a client: restart its billing instead.'
    )
  }
  const startsOn = monthOf(input.effective)
  await tx.insert(clientBillingPeriods).values({
    companyId: input.companyId,
    startsOn,
    createdBy: input.actorId,
  })
  return { startsOn }
}

/**
 * Stop billing. `current_month`: not billed this month (it ends last month).
 * `next_month`: billed through this month. A stretch that would end before
 * it began never billed anything, so it is removed.
 */
export async function stopBilling(
  tx: DbTransaction,
  input: { companyId: string; effective: BillingEffective }
): Promise<{ lastMonth: string | null }> {
  const period = await latestPeriod(tx, input.companyId)
  if (!period || (period.endsOn && period.endsOn < currentMonthStartUtc())) {
    throw new BillingPeriodError('Billing has already stopped.')
  }
  const lastMonth =
    input.effective === 'current_month'
      ? previousMonthStartUtc()
      : currentMonthStartUtc()
  const now = new Date().toISOString()
  if (lastMonth < period.startsOn) {
    await tx
      .update(clientBillingPeriods)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(clientBillingPeriods.id, period.id))
    return { lastMonth: null }
  }
  await tx
    .update(clientBillingPeriods)
    .set({ endsOn: lastMonth, updatedAt: now })
    .where(eq(clientBillingPeriods.id, period.id))
  return { lastMonth }
}

/**
 * Restart a former client's billing this month or next. A stop that hasn't
 * taken effect yet (billed through this month) is simply cancelled.
 */
export async function restartBilling(
  tx: DbTransaction,
  input: { companyId: string; effective: BillingEffective; actorId: string }
): Promise<{ startsOn: string }> {
  const period = await latestPeriod(tx, input.companyId)
  if (!period) {
    throw new BillingPeriodError('That company was never a client.')
  }
  const startsOn = monthOf(input.effective)
  const now = new Date().toISOString()
  if (!period.endsOn) {
    throw new BillingPeriodError('That company is already a client.')
  }
  if (startsOn <= monthAfter(period.endsOn)) {
    // No gap between the stop and the restart: keep one stretch.
    await tx
      .update(clientBillingPeriods)
      .set({ endsOn: null, updatedAt: now })
      .where(eq(clientBillingPeriods.id, period.id))
    return { startsOn: period.startsOn }
  }
  await tx.insert(clientBillingPeriods).values({
    companyId: input.companyId,
    startsOn,
    createdBy: input.actorId,
  })
  return { startsOn }
}

/** Remove every billing stretch (a permanent client delete). */
export async function removeBilling(tx: DbTransaction, companyId: string) {
  const now = new Date().toISOString()
  await tx
    .update(clientBillingPeriods)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(clientBillingPeriods.companyId, companyId),
        isNull(clientBillingPeriods.deletedAt)
      )
    )
}
