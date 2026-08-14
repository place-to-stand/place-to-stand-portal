'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { LEAD_STATUS_VALUES } from '@/lib/leads/constants'
import { upsertLeadStageSetting } from '@/lib/queries/lead-stage-settings'

const stageThresholdSchema = z.object({
  status: z.enum(LEAD_STATUS_VALUES),
  /**
   * Positive integer up to a year, or null for "never stale".
   *
   * 0 is rejected deliberately: a zero-day threshold marks every lead overdue
   * the moment it is created, which is indistinguishable from a broken feature.
   */
  staleAfterDays: z
    .number()
    .int('Use a whole number of days.')
    .min(1, 'Use at least 1 day — 0 would flag every lead immediately.')
    .max(365, 'Use 365 days or fewer.')
    .nullable(),
})

const saveLeadStageSettingsSchema = z.array(stageThresholdSchema).min(1)

export type SaveLeadStageSettingsResult =
  | { ok: true }
  | { ok: false; error: string }

export async function saveLeadStageSettings(
  input: z.infer<typeof saveLeadStageSettingsSchema>
): Promise<SaveLeadStageSettingsResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = saveLeadStageSettingsSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid cadence settings.',
    }
  }

  try {
    for (const { status, staleAfterDays } of parsed.data) {
      await upsertLeadStageSetting(status, staleAfterDays)
    }

    // Both paths: the board's staleness dots are derived from these values, so
    // leaving /leads cached makes a saved threshold look like it did nothing
    // until something else happens to invalidate the page (W17).
    revalidatePath('/leads')
    revalidatePath('/leads/settings')

    return { ok: true }
  } catch (error) {
    console.error('Failed to save lead stage settings:', error)
    return { ok: false, error: 'Unable to save settings. Please try again.' }
  }
}
