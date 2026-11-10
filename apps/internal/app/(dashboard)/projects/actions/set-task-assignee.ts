'use server'

import { z } from 'zod'

import type { SetAssigneeResult } from '@/lib/assignees/types'
import { requirePage } from '@/lib/auth/session'
import { setTaskAssigneeForActor } from '@/lib/tasks/set-task-assignee'

import { revalidateProjectTaskViews } from './shared'

const schema = z.object({
  taskId: z.uuid(),
  assigneeId: z.uuid().nullable(),
})

/** The task right-click menu's "Set assignee" (null clears it). */
export async function setTaskAssignee(input: {
  taskId: string
  assigneeId: string | null
}): Promise<SetAssigneeResult> {
  const user = await requirePage('projects.view_member')

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid assignee update.' }
  }

  const result = await setTaskAssigneeForActor(
    user,
    parsed.data.taskId,
    parsed.data.assigneeId,
    'ADMIN_UI'
  )
  if (result.ok) await revalidateProjectTaskViews()
  return result
}
