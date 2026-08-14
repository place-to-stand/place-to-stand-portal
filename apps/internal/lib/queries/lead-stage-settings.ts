import 'server-only'

import { asc } from 'drizzle-orm'
import { cache } from 'react'

import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leadStageSettings } from '@/lib/db/schema'
import type { LeadStatusValue } from '@/lib/leads/constants'

export type LeadStageSettingRow = {
  status: LeadStatusValue
  staleAfterDays: number | null
}

export type LeadStaleThresholds = Map<LeadStatusValue, number | null>

/**
 * All configured follow-up thresholds, keyed by status.
 *
 * At most seven rows, so the table is read whole and `cache()`-wrapped — the
 * board page, the lead sheet, and the settings page share one read per request.
 *
 * Takes `AppUser` and asserts admin even though every current caller is already
 * guarded: there is no RLS backstop in this project, and a shared query helper
 * that cannot authorize itself is one refactor away from being called from
 * somewhere unguarded (W26).
 *
 * A status absent from the returned map is NOT "never stale" — resolution
 * continues to the `LEAD_STALE_AFTER_DAYS` fallback (C14). Only an explicit
 * `null` value means never.
 */
export const fetchLeadStaleThresholds = cache(
  async (user: AppUser): Promise<LeadStaleThresholds> => {
    assertAdmin(user)

    const rows = await db
      .select({
        status: leadStageSettings.status,
        staleAfterDays: leadStageSettings.staleAfterDays,
      })
      .from(leadStageSettings)
      .orderBy(asc(leadStageSettings.status))

    return new Map(rows.map(row => [row.status, row.staleAfterDays]))
  }
)

/**
 * The settings page needs the rows in a stable, presentable order rather than a
 * lookup map. Same read, shaped for the form.
 */
export async function listLeadStageSettings(
  user: AppUser
): Promise<LeadStageSettingRow[]> {
  const thresholds = await fetchLeadStaleThresholds(user)
  return [...thresholds.entries()].map(([status, staleAfterDays]) => ({
    status,
    staleAfterDays,
  }))
}

/**
 * UPSERT one stage's threshold on the `status` unique constraint.
 */
export async function upsertLeadStageSetting(
  status: LeadStatusValue,
  staleAfterDays: number | null
): Promise<void> {
  await db
    .insert(leadStageSettings)
    .values({ status, staleAfterDays })
    .onConflictDoUpdate({
      target: leadStageSettings.status,
      set: { staleAfterDays, updatedAt: new Date().toISOString() },
    })
}
