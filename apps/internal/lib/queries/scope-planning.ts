import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  scopePlanningSessions,
  planThreads,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Scope Planning Sessions
// ---------------------------------------------------------------------------

export async function getActiveScopeSession(sowId: string) {
  const [session] = await db
    .select()
    .from(scopePlanningSessions)
    .where(
      and(
        eq(scopePlanningSessions.sowId, sowId),
        eq(scopePlanningSessions.status, 'active')
      )
    )
    .limit(1)

  return session ?? null
}

export async function createScopeSession(values: {
  sowId: string
  repoLinkId: string
  snapshotId?: string
  createdBy: string
}) {
  const [session] = await db
    .insert(scopePlanningSessions)
    .values(values)
    .returning()

  return session
}

export async function updateScopeSessionStatus(
  sessionId: string,
  status: 'active' | 'finalized'
) {
  await db
    .update(scopePlanningSessions)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(scopePlanningSessions.id, sessionId))
}

// ---------------------------------------------------------------------------
// Scope Threads (uses shared plan_threads table with scope_session_id)
// ---------------------------------------------------------------------------

export async function getThreadsForScopeSession(scopeSessionId: string) {
  return db
    .select()
    .from(planThreads)
    .where(eq(planThreads.scopeSessionId, scopeSessionId))
    .orderBy(asc(planThreads.createdAt))
}

export async function createScopeThread(
  scopeSessionId: string,
  model: string,
  modelLabel: string
) {
  const [thread] = await db
    .insert(planThreads)
    .values({ scopeSessionId, model, modelLabel })
    .returning()

  return thread
}
