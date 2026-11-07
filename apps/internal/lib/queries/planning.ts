import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  planningSessions,
  planThreads,
  planRevisions,
  planMessages,
  projects,
  tasks,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * A task's planning session, regardless of status. `status` is a display
 * flag ('active' = still drafting, 'deployed' = dispatched at least once) —
 * the session and its chat history stay reusable either way, so lookup must
 * not filter it out once deployed.
 */
export async function getSessionByTaskId(taskId: string) {
  const [session] = await db
    .select()
    .from(planningSessions)
    .where(eq(planningSessions.taskId, taskId))
    .orderBy(desc(planningSessions.createdAt))
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

/**
 * Activity-log context for a thread: the owning session plus the task's
 * project/client so PLAN events land in the right feeds.
 */
export async function getPlanningContextForThread(threadId: string) {
  const [row] = await db
    .select({
      sessionId: planThreads.sessionId,
      taskId: tasks.id,
      taskTitle: tasks.title,
      projectId: tasks.projectId,
      companyId: projects.companyId,
    })
    .from(planThreads)
    .innerJoin(planningSessions, eq(planningSessions.id, planThreads.sessionId))
    .innerJoin(tasks, eq(tasks.id, planningSessions.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(planThreads.id, threadId))
    .limit(1)

  return row ?? null
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export async function getThreadById(threadId: string) {
  const [thread] = await db
    .select()
    .from(planThreads)
    .where(eq(planThreads.id, threadId))
    .limit(1)

  return thread ?? null
}

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
// Generation status (lets the frontend detect and resume an in-flight or
// just-finished generation after navigating away mid-stream and back)
// ---------------------------------------------------------------------------

/**
 * A write still marked streaming this long after its session was last
 * touched is dead: the server function running it was cut off before it
 * could record the end. Longer than any Vercel function may run.
 */
export const STALE_GENERATION_MINUTES = 20

/** SQL: the session was last touched longer ago than a write can run. */
export const sessionGenerationStaleSql = sql<boolean>`${planningSessions.updatedAt} < now() - make_interval(mins => ${STALE_GENERATION_MINUTES})`

/**
 * Marks the thread as writing, unless another write is already running.
 * Returns false when one is. Claiming also touches the session's
 * `updated_at`, which is how a later claim or read tells a dead write
 * (older than STALE_GENERATION_MINUTES) from a live one. The clock is per
 * session, not per thread, so activity on a sibling thread delays a dead
 * thread's timeout; sessions have one thread today. A per-thread start
 * column would fix that and is left for a later migration.
 */
export async function claimThreadGeneration(
  threadId: string,
  version: number
): Promise<boolean> {
  return db.transaction(async tx => {
    const [current] = await tx
      .select({
        sessionId: planThreads.sessionId,
        generationStatus: planThreads.generationStatus,
        stale: sessionGenerationStaleSql,
      })
      .from(planThreads)
      .innerJoin(
        planningSessions,
        eq(planningSessions.id, planThreads.sessionId)
      )
      .where(eq(planThreads.id, threadId))
      .limit(1)
      .for('update', { of: [planThreads, planningSessions] })

    if (!current) return false
    if (current.generationStatus === 'streaming' && !current.stale) {
      return false
    }

    await tx
      .update(planThreads)
      .set({
        generationStatus: 'streaming',
        generatingVersion: version,
        partialContent: '',
        generationError: null,
      })
      .where(eq(planThreads.id, threadId))

    await tx
      .update(planningSessions)
      .set({ updatedAt: sql`now()` })
      .where(eq(planningSessions.id, current.sessionId))

    return true
  })
}

export async function updateThreadPartialContent(
  threadId: string,
  partialContent: string
) {
  await db
    .update(planThreads)
    .set({ partialContent })
    .where(eq(planThreads.id, threadId))
}

export async function finishThreadGeneration(threadId: string) {
  await db
    .update(planThreads)
    .set({ generationStatus: 'idle' })
    .where(eq(planThreads.id, threadId))
}

export async function failThreadGeneration(threadId: string, error: string) {
  await db
    .update(planThreads)
    .set({ generationStatus: 'error', generationError: error })
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
  // chk_plan_messages_role
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
) {
  const [message] = await db
    .insert(planMessages)
    .values({ threadId, role, content, metadata })
    .returning()

  return message
}
