'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { planningSessionCreatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { requireUser } from '@/lib/auth/session'
import { ensureTaskAccess } from '@/lib/auth/permissions'
import { toPlanThreadData } from '@/lib/data/planning'
import { db } from '@/lib/db'
import { projects, tasks } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import type { PlanThreadData } from '@/lib/planning/types'
import {
  createSession,
  createThread,
  getSessionByTaskId,
} from '@/lib/queries/planning'

// ---------------------------------------------------------------------------
// Start a planning thread
// ---------------------------------------------------------------------------

const startThreadSchema = z.object({
  taskId: z.string().uuid(),
  repoLinkId: z.string().uuid(),
  model: z.string().min(1),
  modelLabel: z.string().min(1),
})

type StartThreadResult =
  { sessionId: string; thread: PlanThreadData } | { error: string }

/**
 * The first write planning makes, and only on an explicit action (Start
 * planning, or a new model thread). Opening the panel only reads
 * (`GET /api/tasks/[taskId]/planning`); this creates the task's session if it
 * has none, then a thread on it.
 */
export async function startPlanningThread(input: {
  taskId: string
  repoLinkId: string
  model: string
  modelLabel: string
}): Promise<StartThreadResult> {
  const user = await requireUser()

  const parsed = startThreadSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { taskId, repoLinkId, model, modelLabel } = parsed.data

  try {
    await ensureTaskAccess(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    return { error: 'Unable to authorize request.' }
  }

  let session = await getSessionByTaskId(taskId)

  if (!session) {
    session = await createSession(taskId, repoLinkId, user.id)

    const [task] = await db
      .select({
        title: tasks.title,
        projectId: tasks.projectId,
        companyId: projects.companyId,
      })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .where(eq(tasks.id, taskId))
      .limit(1)

    const event = planningSessionCreatedEvent({
      taskId,
      taskTitle: task?.title ?? 'Untitled task',
    })
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'PLAN',
      targetId: session.id,
      targetProjectId: task?.projectId ?? null,
      targetCompanyId: task?.companyId ?? null,
      metadata: event.metadata,
    })
  }

  const thread = await createThread(session.id, model, modelLabel)

  return { sessionId: session.id, thread: toPlanThreadData(thread) }
}
