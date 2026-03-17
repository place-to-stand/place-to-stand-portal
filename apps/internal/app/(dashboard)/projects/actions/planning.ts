'use server'

import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import {
  getActiveSessionByTaskId,
  createSession,
  getThreadsForSession,
  createThread,
  getRevisions,
  getMessages,
} from '@/lib/queries/planning'

// ---------------------------------------------------------------------------
// Get or Create Session
// ---------------------------------------------------------------------------

const getOrCreateSessionSchema = z.object({
  taskId: z.string().uuid(),
  repoLinkId: z.string().uuid(),
})

export type PlanningSessionData = {
  sessionId: string
  threads: Array<{
    id: string
    model: string
    modelLabel: string
    currentVersion: number
  }>
}

type SessionResult = { data: PlanningSessionData } | { error: string }

export async function getOrCreatePlanningSession(input: {
  taskId: string
  repoLinkId: string
}): Promise<SessionResult> {
  const user = await requireUser()

  const parsed = getOrCreateSessionSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { taskId, repoLinkId } = parsed.data

  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    return { error: 'Unable to authorize request.' }
  }

  let session = await getActiveSessionByTaskId(taskId)

  if (!session) {
    session = await createSession(taskId, repoLinkId, user.id)
  }

  const threads = await getThreadsForSession(session.id)

  return {
    data: {
      sessionId: session.id,
      threads: threads.map(t => ({
        id: t.id,
        model: t.model,
        modelLabel: t.modelLabel,
        currentVersion: t.currentVersion,
      })),
    },
  }
}

// ---------------------------------------------------------------------------
// Add Model Thread
// ---------------------------------------------------------------------------

const addThreadSchema = z.object({
  sessionId: z.string().uuid(),
  model: z.string(),
  modelLabel: z.string(),
})

type AddThreadResult =
  | { thread: { id: string; model: string; modelLabel: string; currentVersion: number } }
  | { error: string }

export async function addPlanThread(input: {
  sessionId: string
  model: string
  modelLabel: string
}): Promise<AddThreadResult> {
  await requireUser()

  const parsed = addThreadSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { sessionId, model, modelLabel } = parsed.data

  const thread = await createThread(sessionId, model, modelLabel)

  return {
    thread: {
      id: thread.id,
      model: thread.model,
      modelLabel: thread.modelLabel,
      currentVersion: thread.currentVersion,
    },
  }
}

// ---------------------------------------------------------------------------
// Fetch Revisions
// ---------------------------------------------------------------------------

const fetchRevisionsSchema = z.object({
  threadId: z.string().uuid(),
})

export type PlanRevisionData = {
  id: string
  version: number
  content: string
  feedback: string | null
  createdAt: string
}

type RevisionsResult = { revisions: PlanRevisionData[] } | { error: string }

export async function fetchPlanRevisions(input: {
  threadId: string
}): Promise<RevisionsResult> {
  await requireUser()

  const parsed = fetchRevisionsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const revisions = await getRevisions(parsed.data.threadId)

  return {
    revisions: revisions.map(r => ({
      id: r.id,
      version: r.version,
      content: r.content,
      feedback: r.feedback,
      createdAt: r.createdAt,
    })),
  }
}

// ---------------------------------------------------------------------------
// Fetch Messages (for resuming conversation context)
// ---------------------------------------------------------------------------

export async function fetchPlanMessages(input: { threadId: string }) {
  await requireUser()

  const parsed = fetchRevisionsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const messages = await getMessages(parsed.data.threadId)

  return {
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  }
}
