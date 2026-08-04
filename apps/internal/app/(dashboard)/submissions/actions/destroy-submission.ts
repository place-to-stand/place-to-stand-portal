'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { submissionDestroyedEvent } from '@/lib/activity/events'
import {
  destroyFormSubmission,
  getFormSubmissionById,
} from '@/lib/queries/form-submissions'

import { submissionIdSchema } from './schemas'
import type { ActionResult, SubmissionActionInput } from './types'

/**
 * Permanent delete — only reachable from the Archive tab (the query layer
 * refuses to destroy active rows), mirroring the contacts/hour-blocks
 * archive-then-destroy flow. W2: no PostHog server tracking.
 */
export async function destroySubmission(
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
    return { error: 'Archive the submission before deleting it permanently.' }
  }

  let destroyed

  try {
    destroyed = await destroyFormSubmission(parsed.data.id)
  } catch (error) {
    console.error('Failed to permanently delete submission', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to permanently delete submission.',
    }
  }

  if (destroyed) {
    const event = submissionDestroyedEvent({
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

  revalidatePath('/', 'layout')

  return {}
}
