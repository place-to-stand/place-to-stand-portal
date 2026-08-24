'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { ensureTaskAccess } from '@/lib/auth/permissions'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import { linkTaskToSession } from '@/lib/queries/agent-sessions'

const selectSchema = z.object({
  sessionId: z.string().uuid(),
  taskId: z.string().uuid(),
})

type SelectResult = { ok: true } | { error: string }

export async function selectExistingTaskForSession(input: {
  sessionId: string
  taskId: string
}): Promise<SelectResult> {
  const user = await requireUser()

  const parsed = selectSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid payload.' }
  }

  const { sessionId, taskId } = parsed.data

  try {
    await ensureTaskAccess(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    return { error: 'Unable to authorize request.' }
  }

  await linkTaskToSession({ sessionId, taskId, addedVia: 'selected' })

  revalidatePath(`/agents/${sessionId}`)

  return { ok: true }
}
