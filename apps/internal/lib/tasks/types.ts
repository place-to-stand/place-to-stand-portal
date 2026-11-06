import type { SupabaseClient } from '@supabase/supabase-js'

import type { AppUser } from '@/lib/auth/session'
import type { SaveConflict } from '@/lib/sheets/save-conflict/types'
import type { BaseTaskInput } from '@/lib/tasks/schemas'
import type { ActivitySourceValue } from '@/lib/types'

// A save is all or nothing: the task row, its assignee and its attachment rows
// commit in one transaction. `taskId` means everything landed; `error` means
// nothing did, so retrying is safe.
export type SaveTaskResult =
  | {
      taskId: string
      error?: undefined
      /** The task's version after the save; the sheet's next expected one. */
      updatedAt?: string
      conflict?: undefined
    }
  | {
      error: string
      taskId?: undefined
      /** Set when someone else saved first and nothing was written. */
      conflict?: SaveConflict
    }

/** Someone else saved the task after the sheet loaded it. */
export const TASK_SAVED_ELSEWHERE =
  'Someone else saved this task. Reload to see their changes.'

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
  storage: SupabaseClient
  input: BaseTaskInput
  /** Deduplicated; `syncAssignees` does not dedupe on its own. */
  assigneeIds: string[]
  source: ActivitySourceValue
}
