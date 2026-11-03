'use server'

import { z } from 'zod'

import { requirePage } from '@/lib/auth/session'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { archiveTask } from '@/lib/tasks/archive-task'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

export async function removeTask(input: {
  taskId: string
}): Promise<ActionResult> {
  const user = await requirePage('projects.view_member')
  const parsed = z.object({ taskId: z.guid() }).safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete payload.' }
  }

  try {
    await archiveTask(user, parsed.data.taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Task not found.' }
    }
    if (error instanceof ForbiddenError) {
      return { error: 'You do not have permission to archive this task.' }
    }
    console.error('Failed to archive task', error)
    return { error: 'Unable to archive task.' }
  }

  await revalidateProjectTaskViews()
  return {}
}
