'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { recloseMonth } from '@/lib/data/reports/close'

import { closePeriodSchema, type ClosePeriodInput } from './schemas'
import type { CloseActionResult } from './types'

/**
 * One-click drift fix: atomic swap in the data layer (derive first, then
 * soft-delete + insert in one transaction) — never sequential reopen→close.
 */
export async function recloseMonthAction(
  input: ClosePeriodInput
): Promise<CloseActionResult> {
  const user = await requireUser()

  const parsed = closePeriodSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  const result = await recloseMonth(user, parsed.data)

  if (!result.error) {
    revalidatePath('/reports/monthly-close')
  }

  return result
}
