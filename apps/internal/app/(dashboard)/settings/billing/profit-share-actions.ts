'use server'

import { revalidatePath } from 'next/cache'
import { and, inArray, sql } from 'drizzle-orm'

import { businessSettings, users } from '@pts/db/schema'

import { businessSettingsUpdatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requirePage } from '@/lib/auth/session'
import {
  profitShareSettingsSchema,
  type ProfitShareSettingsInput,
  type ProfitShareSettingsValues,
} from '@/lib/billing/profit-share-form'
import { db } from '@/lib/db'
import { eligiblePartner } from '@/lib/queries/reports/profit-share-partners'

export type SaveProfitShareResult =
  | { ok: true }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof ProfitShareSettingsValues, string>>
    }

/**
 * Saves the Profit share section of Settings → Billing onto the one
 * business_settings row. Closed months keep the policy frozen in their
 * snapshot, so a change here only moves open months.
 */
export async function saveProfitShareSettings(
  input: ProfitShareSettingsInput
): Promise<SaveProfitShareResult> {
  const user = await requirePage('billing.manage')

  const parsed = profitShareSettingsSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Partial<
      Record<keyof ProfitShareSettingsValues, string>
    > = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ProfitShareSettingsValues
      fieldErrors[key] ??= issue.message
    }
    return { ok: false, error: 'Check the highlighted fields.', fieldErrors }
  }
  const values = parsed.data

  if (!(await partnersAreStaff(values.profitSharePartnerIds))) {
    return {
      ok: false,
      error: 'Check the highlighted fields.',
      fieldErrors: { profitSharePartnerIds: 'Pick partners from the list.' },
    }
  }

  const [current] = await db
    .select({
      startsOn: businessSettings.profitShareStartsOn,
      minimumBalance: businessSettings.profitShareMinimumBalance,
      partnerIds: businessSettings.profitSharePartnerIds,
    })
    .from(businessSettings)
    .limit(1)
  const before = {
    startsOn: current?.startsOn ?? null,
    minimumBalance: Number(current?.minimumBalance ?? 0),
    partnerIds: current?.partnerIds ?? [],
  }
  const after = {
    startsOn: values.profitShareStartMonth
      ? `${values.profitShareStartMonth}-01`
      : null,
    minimumBalance: Number(values.profitShareMinimumBalance || 0),
    partnerIds: values.profitSharePartnerIds,
  }

  const row = {
    profitShareStartsOn: after.startsOn,
    profitShareMinimumBalance: after.minimumBalance.toFixed(2),
    profitSharePartnerIds: after.partnerIds,
    updatedBy: user.id,
    updatedAt: sql`now()`,
  }
  // The row may not exist yet on a new install: create it unconfirmed, so
  // the Business setup banner still shows until someone saves that page.
  await db
    .insert(businessSettings)
    .values({ id: true, ...row })
    .onConflictDoUpdate({ target: businessSettings.id, set: row })

  const changedFields: string[] = []
  if (before.startsOn !== after.startsOn) {
    changedFields.push('profit share start month')
  }
  if (before.minimumBalance !== after.minimumBalance) {
    changedFields.push('profit share minimum balance')
  }
  if (before.partnerIds.join() !== after.partnerIds.join()) {
    changedFields.push('profit share partners')
  }
  if (changedFields.length) {
    const event = businessSettingsUpdatedEvent({
      changedFields,
      details: {
        before: { profitShare: before },
        after: { profitShare: after },
      },
    })
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'SETTINGS',
      targetId: null,
      metadata: event.metadata,
    })
  }

  revalidatePath('/settings/billing')
  revalidatePath('/reports/monthly-close')
  return { ok: true }
}

/** Every partner can split the profit share (`eligiblePartner`). */
async function partnersAreStaff(ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)]
  if (unique.length !== ids.length) return false
  if (unique.length === 0) return true
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, unique), eligiblePartner))
  return rows.length === unique.length
}
