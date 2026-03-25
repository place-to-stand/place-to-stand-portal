'use server'

import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import {
  getActiveScopeSession,
  createScopeSession,
  getThreadsForScopeSession,
  createScopeThread,
} from '@/lib/queries/scope-planning'
import { getRevisions } from '@/lib/queries/planning'
import { getCurrentSnapshot } from '@/lib/queries/sow'

// ---------------------------------------------------------------------------
// Get or Create Scope Planning Session
// ---------------------------------------------------------------------------

const getOrCreateSchema = z.object({
  sowId: z.string().uuid(),
  repoLinkId: z.string().uuid(),
})

export type ScopePlanningSessionData = {
  sessionId: string
  threads: Array<{
    id: string
    model: string
    modelLabel: string
    currentVersion: number
  }>
}

type SessionResult = { data: ScopePlanningSessionData } | { error: string }

export async function getOrCreateScopePlanningSession(input: {
  sowId: string
  repoLinkId: string
}): Promise<SessionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = getOrCreateSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { sowId, repoLinkId } = parsed.data

  // Get latest snapshot ID for the session
  const snapshot = await getCurrentSnapshot(sowId)

  let session = await getActiveScopeSession(sowId)

  if (!session) {
    session = await createScopeSession({
      sowId,
      repoLinkId,
      snapshotId: snapshot?.id,
      createdBy: user.id,
    })
  }

  const threads = await getThreadsForScopeSession(session.id)

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
// Add Thread to Scope Session
// ---------------------------------------------------------------------------

const addThreadSchema = z.object({
  sessionId: z.string().uuid(),
  model: z.string(),
  modelLabel: z.string(),
})

type AddThreadResult =
  | {
      thread: {
        id: string
        model: string
        modelLabel: string
        currentVersion: number
      }
    }
  | { error: string }

export async function addScopePlanThread(input: {
  sessionId: string
  model: string
  modelLabel: string
}): Promise<AddThreadResult> {
  await requireUser()

  const parsed = addThreadSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { sessionId, model, modelLabel } = parsed.data

  const thread = await createScopeThread(sessionId, model, modelLabel)

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
// Fetch Scope Plan Revisions (delegates to shared planning queries)
// ---------------------------------------------------------------------------

const fetchRevisionsSchema = z.object({
  threadId: z.string().uuid(),
})

export async function fetchScopePlanRevisions(input: {
  threadId: string
}) {
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
