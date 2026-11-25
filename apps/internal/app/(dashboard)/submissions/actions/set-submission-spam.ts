'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import {
  submissionMarkedNotSpamEvent,
  submissionMarkedSpamEvent,
} from '@/lib/activity/events'
import {
  getFormSubmissionById,
  setFormSubmissionSpam,
} from '@/lib/queries/form-submissions'

import { submissionIdSchema } from './schemas'
import type { ActionResult, SubmissionActionInput } from './types'

async function setSpam(
  input: SubmissionActionInput,
  spam: boolean
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = submissionIdSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  const existing = await getFormSubmissionById(parsed.data.id)

  if (!existing) {
    return { error: 'Submission not found.' }
  }

  let updated

  try {
    updated = await setFormSubmissionSpam(parsed.data.id, spam)
  } catch (error) {
    console.error('Failed to change submission spam flag', error)
    return {
      error: spam
        ? 'Unable to mark submission as spam.'
        : 'Unable to mark submission as not spam.',
    }
  }

  // Log only on a real change: a double-click is a no-op.
  if (updated) {
    const args = {
      kind: existing.kind,
      contactName: existing.contactName,
      contactEmail: existing.contactEmail,
      status: existing.status,
    }
    const event = spam
      ? submissionMarkedSpamEvent(args)
      : submissionMarkedNotSpamEvent(args)

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'SUBMISSION',
      targetId: existing.id,
      // Submissions precede any client relationship.
      targetCompanyId: null,
      metadata: event.metadata,
    })
  }

  // Spam leaves the unacknowledged count; "Not spam" puts it back.
  revalidatePath('/', 'layout')

  return {}
}

// Deliberately no PostHog server tracking (see acknowledge-submission.ts).
export async function markSubmissionSpam(
  input: SubmissionActionInput
): Promise<ActionResult> {
  return setSpam(input, true)
}

/** Clears the flag and re-flags the row as unacknowledged. Sends no email. */
export async function markSubmissionNotSpam(
  input: SubmissionActionInput
): Promise<ActionResult> {
  return setSpam(input, false)
}
