'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { submissionAcknowledgedEvent } from '@/lib/activity/events'
import {
  acknowledgeFormSubmission,
  getFormSubmissionById,
} from '@/lib/queries/form-submissions'

import { submissionIdSchema } from './schemas'
import type { ActionResult, SubmissionActionInput } from './types'

// W2 (PRD 001 architecture review): deliberately no PostHog server tracking —
// trackSettingsServerInteraction's SettingsEntity union has no submissions
// value and its SETTINGS_SAVE event would misclassify inbox actions.
export async function acknowledgeSubmission(
  input: SubmissionActionInput
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

  if (existing.acknowledgedAt === null) {
    let updated

    try {
      updated = await acknowledgeFormSubmission(parsed.data.id, user.id)
    } catch (error) {
      console.error('Failed to acknowledge submission', error)

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to acknowledge submission.',
      }
    }

    // Log only on real state change — the idempotent no-op path (a racing
    // admin acknowledged first) must not emit a duplicate event.
    if (updated) {
      const event = submissionAcknowledgedEvent({
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
  }

  // D6: the unread badge lives in the (dashboard) layout — revalidate the
  // whole layout tree so the sidebar count refreshes on the next render.
  revalidatePath('/', 'layout')

  return {}
}
