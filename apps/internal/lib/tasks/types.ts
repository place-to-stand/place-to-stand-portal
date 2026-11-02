import type { SupabaseClient } from '@supabase/supabase-js'

import type { AppUser } from '@/lib/auth/session'
import type { BaseTaskInput } from '@/app/(dashboard)/projects/actions/shared-schemas'
import type { Database } from '@/lib/supabase/types'
import type { ActivitySourceValue } from '@/lib/types'

// A save is all or nothing: the task row, its assignee and its attachment rows
// commit in one transaction. `taskId` means everything landed; `error` means
// nothing did, so retrying is safe.
export type SaveTaskResult =
  | { taskId: string; error?: undefined }
  | { error: string; taskId?: undefined }

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
  source: ActivitySourceValue
}
