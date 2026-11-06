'use server'

import { z } from 'zod'

import { requirePage } from '@/lib/auth/session'
import { roleCan } from '@/lib/auth/capabilities'
import type {
  BulkActionResult,
  BulkSelectionInput,
} from '@/lib/bulk/archive-entities'
import { getFormSubmissionById } from '@/lib/queries/form-submissions'

import { bulkSelectionSchema, resolveBulkIds } from '../../_lib/bulk-selection'
import { runBulk } from '../../_lib/run-bulk'
import { acknowledgeSubmission } from './acknowledge-submission'

const inputSchema = z.object({
  selection: bulkSelectionSchema,
  /** Each ticked row's `lastActivityAt` as rendered (the stale-view guard). */
  versions: z.record(z.string(), z.string()).optional(),
})

/**
 * Acknowledge many submissions through the row action, so each keeps its
 * activity entry and stale-view guard: a ticked row that changed since it
 * was rendered is refused, not acknowledged unseen. Rows picked by "select
 * all" were never rendered, so they are checked against their current state.
 */
// permission: portal.sign_in — then submissions.manage, and each row's acknowledgeSubmission checks again
export async function bulkAcknowledgeSubmissions(input: {
  selection: BulkSelectionInput
  versions?: Record<string, string>
}): Promise<BulkActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { done: 0, failed: [], warnings: [], error: 'Invalid request.' }
  }
  const user = await requirePage('portal.sign_in')
  if (!roleCan(user.role, 'submissions.manage')) {
    return {
      done: 0,
      failed: [],
      warnings: [],
      error: 'You do not have access to do that.',
    }
  }

  const resolved = await resolveBulkIds(
    user,
    'submission',
    parsed.data.selection,
    false
  )
  if ('error' in resolved) {
    return { done: 0, failed: [], warnings: [], error: resolved.error }
  }

  const versions = parsed.data.versions ?? {}
  return runBulk(resolved.ids, async id => {
    const row = await getFormSubmissionById(id)
    if (!row) return { error: 'Submission not found.' }
    if (row.acknowledgedAt !== null) return {}
    return acknowledgeSubmission({
      id,
      expectedLastActivityAt: versions[id] ?? row.lastActivityAt,
    })
  })
}
