'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { restoreTask as restoreTaskFor } from '@/lib/tasks/archive-task'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

export async function restoreTask(input: {
  taskId: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = z.object({ taskId: z.guid() }).safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid restore payload.' }
  }

  try {
    await restoreTaskFor(user, parsed.data.taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Task not found.' }
    }
    if (error instanceof ForbiddenError) {
      return { error: error.message }
    }
    console.error('Failed to restore task', error)
    return { error: 'Unable to restore task.' }
  }

  await revalidateProjectTaskViews()
  return {}
}
