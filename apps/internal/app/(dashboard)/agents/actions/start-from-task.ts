'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireRole } from '@/lib/auth/session'
import { ensureTaskAccess } from '@/lib/auth/permissions'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import { createAgentSession, linkTaskToSession } from '@/lib/queries/agent-sessions'

const startSchema = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
})

type StartResult = { sessionId: string } | { error: string }

/**
 * "Start agent session" from a task card or the task sheet — creates a
 * session scoped to the task's project and links the task in the same step,
 * so the chat opens with the task already in context instead of the human
 * re-describing it.
 */
export async function startAgentSessionFromTask(input: {
  taskId: string
  projectId: string
}): Promise<StartResult> {
  const user = await requireRole('ADMIN')

  const parsed = startSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid payload.' }
  }

  const { taskId, projectId } = parsed.data

  try {
    await ensureTaskAccess(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    return { error: 'Unable to authorize request.' }
  }

  const session = await createAgentSession({
    createdBy: user.id,
    clientId: null,
    projectId,
    repoLinkId: null,
  })

  await linkTaskToSession({ sessionId: session.id, taskId, addedVia: 'selected' })

  revalidatePath('/agents')

  return { sessionId: session.id }
}
