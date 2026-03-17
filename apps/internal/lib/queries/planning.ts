import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  planningSessions,
  planThreads,
  planRevisions,
  planMessages,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function getActiveSessionByTaskId(taskId: string) {
  const [session] = await db
    .select()
    .from(planningSessions)
    .where(
      and(
        eq(planningSessions.taskId, taskId),
        eq(planningSessions.status, 'active')
      )
    )
    .limit(1)

  return session ?? null
}

export async function createSession(
  taskId: string,
  repoLinkId: string,
  userId: string
) {
  const [session] = await db
    .insert(planningSessions)
    .values({ taskId, repoLinkId, createdBy: userId })
    .returning()

  return session
}

export async function updateSessionStatus(
  sessionId: string,
  status: 'active' | 'deployed'
) {
  await db
    .update(planningSessions)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(planningSessions.id, sessionId))
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export async function getThreadsForSession(sessionId: string) {
  return db
    .select()
    .from(planThreads)
    .where(eq(planThreads.sessionId, sessionId))
    .orderBy(asc(planThreads.createdAt))
}

export async function createThread(
  sessionId: string,
  model: string,
  modelLabel: string
) {
  const [thread] = await db
    .insert(planThreads)
    .values({ sessionId, model, modelLabel })
    .returning()

  return thread
}

export async function updateThreadVersion(
  threadId: string,
  currentVersion: number
) {
  await db
    .update(planThreads)
    .set({ currentVersion })
    .where(eq(planThreads.id, threadId))
}

// ---------------------------------------------------------------------------
// Revisions
// ---------------------------------------------------------------------------

export async function getRevisions(threadId: string) {
  return db
    .select()
    .from(planRevisions)
    .where(eq(planRevisions.threadId, threadId))
    .orderBy(asc(planRevisions.version))
}

export async function getRevisionByVersion(threadId: string, version: number) {
  const [revision] = await db
    .select()
    .from(planRevisions)
    .where(
      and(
        eq(planRevisions.threadId, threadId),
        eq(planRevisions.version, version)
      )
    )
    .limit(1)

  return revision ?? null
}

export async function createRevision(
  threadId: string,
  version: number,
  content: string,
  feedback?: string
) {
  const [revision] = await db
    .insert(planRevisions)
    .values({ threadId, version, content, feedback })
    .returning()

  return revision
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getMessages(threadId: string) {
  return db
    .select()
    .from(planMessages)
    .where(eq(planMessages.threadId, threadId))
    .orderBy(asc(planMessages.createdAt))
}

export async function appendMessage(
  threadId: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>
) {
  const [message] = await db
    .insert(planMessages)
    .values({ threadId, role, content, metadata })
    .returning()

  return message
}
