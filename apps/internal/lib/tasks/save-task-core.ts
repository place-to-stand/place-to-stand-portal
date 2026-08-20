import 'server-only'

import {
  baseTaskSchema,
  type BaseTaskInput,
} from '@/app/(dashboard)/projects/actions/shared-schemas'
import type { AppUser } from '@/lib/auth/session'
import { ensureTaskAttachmentBucket } from '@/lib/storage/task-attachments'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ActivitySourceValue } from '@/lib/types'

import { createTaskForActor } from './create-task'
import { updateTaskForActor } from './update-task'
import type { SaveTaskResult } from './types'

export type { SaveTaskResult } from './types'

/**
 * The one create-and-update path for tasks, with the acting admin injected
 * rather than resolved from a session.
 *
 * This lives outside the `'use server'` action module on purpose. Exports of a
 * `'use server'` file are network-callable server actions, so an `actor`
 * parameter there would be attacker-controlled — any signed-in browser user
 * could claim to be someone else. Keeping the core here means the action
 * (`app/(dashboard)/projects/actions/save-task.ts`) resolves the actor from
 * the session cookie, the CLI API resolves it from a bearer token, and neither
 * can be told who it is by the client.
 *
 * Callers own cache revalidation. Revalidate whenever the result carries a
 * `taskId` — that is exactly the set of outcomes where a row was written.
 */
export async function saveTaskForActor(
  actor: AppUser,
  input: BaseTaskInput,
  source: ActivitySourceValue
): Promise<SaveTaskResult> {
  const parsed = baseTaskSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid task payload submitted.' }
  }

  const { id, assigneeIds } = parsed.data
  const storage = getSupabaseServiceClient()

  await ensureTaskAttachmentBucket(storage)

  const context = {
    actor,
    storage,
    input: parsed.data,
    assigneeIds: Array.from(new Set(assigneeIds)),
    source,
  }

  return id
    ? updateTaskForActor(id, context)
    : createTaskForActor(context)
}
