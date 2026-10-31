'use server'

import { requireStaffUser } from '@/lib/auth/session'
import { saveTaskForActor } from '@/lib/tasks/save-task-core'
import type { SaveTaskResult } from '@/lib/tasks/types'

import { revalidateProjectTaskViews } from './shared'
import type { BaseTaskInput } from './shared-schemas'

export type { SaveTaskResult }

/**
 * Browser entry point for creating and updating tasks.
 *
 * All of the work lives in `lib/tasks/save-task-core.ts` so the CLI API can
 * reuse it with a bearer-authenticated actor. This module stays a wrapper for
 * a security reason, not a stylistic one: exports of a `'use server'` file are
 * callable over the network with arbitrary arguments, so the actor must be
 * resolved here from the session rather than accepted as a parameter.
 */
export async function saveTask(input: BaseTaskInput): Promise<SaveTaskResult> {
  const user = await requireStaffUser()
  const result = await saveTaskForActor(user, input, 'ADMIN_UI')

  // A `taskId` means the save committed; an error means nothing was written.
  if (result.taskId) {
    await revalidateProjectTaskViews()
  }

  return result
}
