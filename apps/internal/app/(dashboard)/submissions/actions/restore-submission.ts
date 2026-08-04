'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { submissionRestoredEvent } from '@/lib/activity/events'
import {
  getFormSubmissionById,
  setFormSubmissionArchived,
} from '@/lib/queries/form-submissions'

import { submissionIdSchema } from './schemas'
import type { ActionResult, SubmissionActionInput } from './types'

// W2 (PRD 001 architecture review): deliberately no PostHog server tracking.
export async function restoreSubmission(
  input: SubmissionActionInput
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = submissionIdSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  const existing = await getFormSubmissionById(parsed.data.id, {
    includeArchived: true,
  })

  if (!existing) {
    return { error: 'Submission not found.' }
  }

  if (existing.deletedAt === null) {
    return { error: 'Submission is not archived.' }
  }

  let updated

  try {
    updated = await setFormSubmissionArchived(parsed.data.id, false)
  } catch (error) {
    console.error('Failed to restore submission', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to restore submission.',
    }
  }

  // Log only on real state change — idempotent no-ops emit nothing.
  if (updated) {
    const event = submissionRestoredEvent({
      kind: existing.kind,
      contactName: existing.contactName,
      contactEmail: existing.contactEmail,
      status: existing.status,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'SUBMISSION',
      targetId: existing.id,
      // Submissions precede any client relationship.
      targetClientId: null,
      metadata: event.metadata,
    })
  }

  // D6: restoring an unread row must re-increment the sidebar badge.
  revalidatePath('/', 'layout')

  return {}
}
