'use server'

import { z } from 'zod'

import { requirePage } from '@/lib/auth/session'
import { setTaskDueDateForActor } from '@/lib/tasks/set-task-due-date'

import { revalidateProjectTaskViews } from './shared'
import type { ActionResult } from './action-types'

const dueOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable()

export async function changeTaskDueDate(input: {
  taskId: string
  dueOn: string | null
}): Promise<ActionResult> {
  const user = await requirePage('projects.view_member')
  const parsed = z
    .object({
      taskId: z.string().uuid(),
      dueOn: dueOnSchema,
    })
    .safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid due date update payload.' }
  }

  const { taskId, dueOn } = parsed.data

  const result = await setTaskDueDateForActor(user, taskId, dueOn ?? null)
  if (result.error) return result

  await revalidateProjectTaskViews()

  return {}
}
