import type { SupabaseClient } from '@supabase/supabase-js'

import type { AppUser } from '@/lib/auth/session'
import type { BaseTaskInput } from '@/app/(dashboard)/projects/actions/shared-schemas'
import type { Database } from '@/lib/supabase/types'

// Local widening (do not touch the shared ActionResult): a result carrying
// `taskId` means the row exists — even alongside `error`, which signals a
// failed post-insert step. Clients must never retry the create path for it.
export type SaveTaskResult = {
  error?: string
  taskId?: string
}

/**
 * Everything the create and update branches share, resolved once by
 * `saveTaskForActor` before it dispatches.
 *
 * `actor` is passed explicitly rather than resolved inside: these modules are
 * reached both from a browser server action (session cookie) and from the CLI
 * API (bearer token), and only the caller knows how to authenticate.
 */
export type TaskWriteContext = {
  actor: AppUser
  storage: SupabaseClient<Database>
  input: BaseTaskInput
  /** Deduplicated; `syncAssignees` does not dedupe on its own. */
  assigneeIds: string[]
}
