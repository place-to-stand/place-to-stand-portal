'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requirePage } from '@/lib/auth/session'
import { updateFeedbackReport } from '@/lib/queries/feedback'

import type { FeedbackActionResult } from './types'

const idSchema = z.object({ id: z.uuid() })

/**
 * The quick actions on a report: each is its own record change, saved on its
 * own click (a read-only sheet). `expect` keeps a stale screen from acting on
 * a report that has moved tabs since.
 */
async function change(
  input: unknown,
  patch: (userId: string) => Parameters<typeof updateFeedbackReport>[1],
  expect: Parameters<typeof updateFeedbackReport>[2],
  failure: string
): Promise<FeedbackActionResult> {
  const user = await requirePage('feedback.manage')
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid request.' }

  try {
    const updated = await updateFeedbackReport(
      parsed.data.id,
      patch(user.id),
      expect
    )
    if (!updated)
      return { error: 'This report has changed. Reload and try again.' }
  } catch (error) {
    console.error(failure, error)
    return { error: failure }
  }

  // The sidebar's count of new reports.
  revalidatePath('/', 'layout')
  return {}
}

export async function acknowledgeFeedback(input: { id: string }) {
  return change(
    input,
    userId => ({
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: userId,
    }),
    { archived: false },
    'Unable to mark the report as seen.'
  )
}

export async function unacknowledgeFeedback(input: { id: string }) {
  return change(
    input,
    () => ({ acknowledgedAt: null, acknowledgedBy: null }),
    { archived: false },
    'Unable to mark the report as new.'
  )
}

export async function markFeedbackSpam(input: { id: string }) {
  return change(
    input,
    () => ({ spamReason: 'marked' }),
    { archived: false },
    'Unable to mark the report as spam.'
  )
}

/** Not spam also makes the report new again, so somebody reads it. */
export async function markFeedbackNotSpam(input: { id: string }) {
  return change(
    input,
    () => ({ spamReason: null, acknowledgedAt: null, acknowledgedBy: null }),
    { archived: false },
    'Unable to mark the report as not spam.'
  )
}

export async function archiveFeedback(input: { id: string }) {
  return change(
    input,
    () => ({ deletedAt: new Date().toISOString() }),
    { archived: false },
    'Unable to archive the report.'
  )
}

export async function restoreFeedback(input: { id: string }) {
  return change(
    input,
    () => ({ deletedAt: null }),
    { archived: true },
    'Unable to restore the report.'
  )
}
