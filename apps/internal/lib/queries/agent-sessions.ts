import 'server-only'

import { and, asc, count, desc, eq, inArray, isNotNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  agentSessions,
  agentMessages,
  agentProposedTasks,
  agentSessionTasks,
  clients,
  projects,
  tasks,
  users,
} from '@/lib/db/schema'

import { taskFields, type SelectTask } from './tasks/common'
import type { AgentSessionTurnStatus, AgentMessageStatus } from '@/lib/agents/types'

export type { AgentSessionTurnStatus, AgentMessageStatus }

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * `createdBy` scopes the list to one admin's own sessions — omit it for the
 * everyone view. Session data itself is never filtered out of the database;
 * this only changes what shows in the sidebar, the same way `listAssignedTaskSummaries`
 * scopes My Tasks without hiding a task from anyone else who looks it up directly.
 */
export async function listAgentSessions(createdBy?: string) {
  return db
    .select()
    .from(agentSessions)
    .where(
      createdBy
        ? and(eq(agentSessions.status, 'active'), eq(agentSessions.createdBy, createdBy))
        : eq(agentSessions.status, 'active')
    )
    .orderBy(desc(agentSessions.createdAt))
}

export async function getAgentSessionById(sessionId: string) {
  const [session] = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.id, sessionId))
    .limit(1)

  return session ?? null
}

export async function createAgentSession(input: {
  createdBy: string
  title?: string | null
  clientId?: string | null
  projectId?: string | null
  repoLinkId?: string | null
}) {
  const [session] = await db
    .insert(agentSessions)
    .values({
      createdBy: input.createdBy,
      title: input.title ?? null,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      repoLinkId: input.repoLinkId ?? null,
    })
    .returning()

  return session
}

export async function updateAgentSessionTitle(sessionId: string, title: string) {
  await db
    .update(agentSessions)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(agentSessions.id, sessionId))
}

export async function archiveAgentSession(sessionId: string) {
  await db
    .update(agentSessions)
    .set({ status: 'archived', updatedAt: new Date().toISOString() })
    .where(eq(agentSessions.id, sessionId))
}

export async function setSessionTurnStatus(sessionId: string, turnStatus: AgentSessionTurnStatus) {
  await db
    .update(agentSessions)
    .set({ turnStatus, updatedAt: new Date().toISOString() })
    .where(eq(agentSessions.id, sessionId))
}

/**
 * Current generation state for one session's polling loop: the denormalized
 * turnStatus plus the latest message row (whose own `status` tracks
 * streaming/complete/error at the message level).
 */
export async function getAgentSessionState(sessionId: string) {
  const session = await getAgentSessionById(sessionId)
  if (!session) return null

  const [latestMessage] = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.sessionId, sessionId))
    .orderBy(desc(agentMessages.createdAt))
    .limit(1)

  return {
    turnStatus: session.turnStatus,
    latestMessage: latestMessage ?? null,
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getSessionMessages(sessionId: string) {
  return db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.sessionId, sessionId))
    .orderBy(asc(agentMessages.createdAt))
}

export async function appendSessionMessage(
  sessionId: string,
  role: string,
  content: string,
  opts?: { userId?: string; metadata?: Record<string, unknown> }
) {
  // The schema-level 'streaming' default exists for insertPlaceholderAssistantMessage;
  // any message appended fully-formed (user turns, in particular) is complete on arrival.
  const [message] = await db
    .insert(agentMessages)
    .values({
      sessionId,
      role,
      content,
      status: 'complete',
      userId: opts?.userId,
      metadata: opts?.metadata,
    })
    .returning()

  return message
}

/**
 * Insert an empty assistant row before streamText() runs, so its id is known
 * inside tool.execute() closures (e.g. propose_task's sourceMessageId) before
 * the model has produced any text.
 */
export async function insertPlaceholderAssistantMessage(sessionId: string) {
  const [message] = await db
    .insert(agentMessages)
    .values({ sessionId, role: 'assistant', content: '' })
    .returning()

  return message
}

export async function updateMessageContent(
  messageId: string,
  content: string,
  opts?: { status?: AgentMessageStatus; metadata?: Record<string, unknown> }
) {
  await db
    .update(agentMessages)
    .set({
      content,
      ...(opts?.status !== undefined ? { status: opts.status } : {}),
      ...(opts?.metadata !== undefined ? { metadata: opts.metadata } : {}),
    })
    .where(eq(agentMessages.id, messageId))
}

// ---------------------------------------------------------------------------
// Proposed tasks
// ---------------------------------------------------------------------------

export async function listProposedTasksForSession(sessionId: string) {
  return db
    .select()
    .from(agentProposedTasks)
    .where(eq(agentProposedTasks.sessionId, sessionId))
    .orderBy(asc(agentProposedTasks.createdAt))
}

export async function getProposedTaskById(proposalId: string) {
  const [proposal] = await db
    .select()
    .from(agentProposedTasks)
    .where(eq(agentProposedTasks.id, proposalId))
    .limit(1)

  return proposal ?? null
}

export async function createProposedTask(input: {
  sessionId: string
  title: string
  description?: string | null
  projectId?: string | null
  sourceMessageId?: string | null
}) {
  const [proposal] = await db
    .insert(agentProposedTasks)
    .values({
      sessionId: input.sessionId,
      title: input.title,
      description: input.description ?? null,
      projectId: input.projectId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
    })
    .returning()

  return proposal
}

export async function resolveProposedTask(
  proposalId: string,
  input: {
    status: 'accepted' | 'rejected'
    resolvedBy: string
    createdTaskId?: string | null
  }
) {
  await db
    .update(agentProposedTasks)
    .set({
      status: input.status,
      resolvedBy: input.resolvedBy,
      resolvedAt: new Date().toISOString(),
      createdTaskId: input.createdTaskId ?? null,
    })
    .where(eq(agentProposedTasks.id, proposalId))
}

// ---------------------------------------------------------------------------
// Session <-> Task links
// ---------------------------------------------------------------------------

export async function listSessionTasks(
  sessionId: string
): Promise<Array<{ id: string; addedVia: 'proposal' | 'selected'; addedAt: string; task: SelectTask }>> {
  const rows = await db
    .select({
      id: agentSessionTasks.id,
      addedVia: agentSessionTasks.addedVia,
      addedAt: agentSessionTasks.addedAt,
      task: taskFields,
    })
    .from(agentSessionTasks)
    .innerJoin(tasks, eq(agentSessionTasks.taskId, tasks.id))
    .where(eq(agentSessionTasks.sessionId, sessionId))
    .orderBy(asc(agentSessionTasks.addedAt))

  return rows
}

export async function linkTaskToSession(input: {
  sessionId: string
  taskId: string
  addedVia: 'proposal' | 'selected'
}) {
  await db
    .insert(agentSessionTasks)
    .values(input)
    .onConflictDoNothing({
      target: [agentSessionTasks.sessionId, agentSessionTasks.taskId],
    })
}

// ---------------------------------------------------------------------------
// Dashboard list support — batched lookups assembled by lib/data/agent-sessions.ts
// ---------------------------------------------------------------------------

export async function countPendingProposalsBySession(
  sessionIds: string[]
): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map()

  const rows = await db
    .select({ sessionId: agentProposedTasks.sessionId, count: count() })
    .from(agentProposedTasks)
    .where(
      and(
        inArray(agentProposedTasks.sessionId, sessionIds),
        eq(agentProposedTasks.status, 'proposed')
      )
    )
    .groupBy(agentProposedTasks.sessionId)

  return new Map(rows.map(row => [row.sessionId, Number(row.count)]))
}

export async function listClientNamesByIds(clientIds: string[]): Promise<Map<string, string>> {
  if (clientIds.length === 0) return new Map()

  const rows = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(inArray(clients.id, clientIds))

  return new Map(rows.map(row => [row.id, row.name]))
}

export async function listProjectSummariesByIds(
  projectIds: string[]
): Promise<Map<string, { name: string; clientId: string | null }>> {
  if (projectIds.length === 0) return new Map()

  const rows = await db
    .select({ id: projects.id, name: projects.name, clientId: projects.clientId })
    .from(projects)
    .where(inArray(projects.id, projectIds))

  return new Map(rows.map(row => [row.id, { name: row.name, clientId: row.clientId }]))
}

export type UserSummary = { id: string; fullName: string | null; email: string; avatarUrl: string | null }

export async function listUserSummariesByIds(userIds: string[]): Promise<Map<string, UserSummary>> {
  if (userIds.length === 0) return new Map()

  const rows = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, userIds))

  return new Map(rows.map(row => [row.id, row]))
}

/**
 * Most recent 'user'-role message's author per session — drives the "last
 * user" avatar on the sessions list (sessions are shared among admins, so
 * this is who most recently picked the session up).
 */
export async function getLastUserMessagePerSession(
  sessionIds: string[]
): Promise<Map<string, { userId: string; createdAt: string }>> {
  if (sessionIds.length === 0) return new Map()

  const rows = await db
    .select({
      sessionId: agentMessages.sessionId,
      userId: agentMessages.userId,
      createdAt: agentMessages.createdAt,
    })
    .from(agentMessages)
    .where(
      and(
        inArray(agentMessages.sessionId, sessionIds),
        eq(agentMessages.role, 'user'),
        isNotNull(agentMessages.userId)
      )
    )
    .orderBy(desc(agentMessages.createdAt))

  const bySession = new Map<string, { userId: string; createdAt: string }>()
  for (const row of rows) {
    if (!row.userId) continue
    if (!bySession.has(row.sessionId)) {
      bySession.set(row.sessionId, { userId: row.userId, createdAt: row.createdAt })
    }
  }

  return bySession
}
