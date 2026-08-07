'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { reopenMonth } from '@/lib/data/reports/close'

import { closePeriodSchema, type ClosePeriodInput } from './schemas'
import type { CloseActionResult } from './types'

export async function reopenMonthAction(
  input: ClosePeriodInput
): Promise<CloseActionResult> {
  const user = await requireUser()

  const parsed = closePeriodSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  const result = await reopenMonth(user, parsed.data)

  if (!result.error) {
    revalidatePath('/reports/monthly-close')
  }

  return result
}
