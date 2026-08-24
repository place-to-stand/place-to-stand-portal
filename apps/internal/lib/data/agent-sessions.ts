import 'server-only'

import {
  listAgentSessions,
  countPendingProposalsBySession,
  listClientNamesByIds,
  listProjectSummariesByIds,
  listUserSummariesByIds,
  getLastUserMessagePerSession,
  getAgentSessionById,
  getSessionMessages,
  listProposedTasksForSession,
  listSessionTasks,
  type AgentSessionTurnStatus,
  type UserSummary,
} from '@/lib/queries/agent-sessions'
import { fetchProjectsWithRelations } from '@/lib/data/projects'
import { listTasksForCli } from '@/lib/cli/queries/tasks'
import { NotFoundError } from '@/lib/errors/http'
import type { AppUser } from '@/lib/auth/session'
import type { GitHubRepoLinkSummary, ProjectWithRelations } from '@/lib/types'
import type {
  AgentMessageAuthor,
  AgentMessageRow,
  AgentProposedTask,
  AgentSessionTaskRow,
  AgentTaskSummary,
} from '@/lib/agents/types'

function toAuthor(summary: UserSummary | undefined): AgentMessageAuthor | null {
  if (!summary) return null
  return { id: summary.id, name: summary.fullName || summary.email, avatarUrl: summary.avatarUrl }
}

export type AgentSessionListItem = {
  id: string
  title: string | null
  status: 'active' | 'archived'
  turnStatus: AgentSessionTurnStatus
  clientId: string | null
  projectId: string | null
  /** "{Client} / {Project}" for a project scope, "All {Client} projects" for a client-only scope, null if unscoped. */
  scopeLabel: string | null
  pendingProposalCount: number
  /** Who most recently sent a message — sessions are shared among admins. */
  lastUser: AgentMessageAuthor | null
  createdAt: string
  updatedAt: string
}

/**
 * Assembles the Agents dashboard list: base session rows, then batched
 * relation lookups (scope names, pending-proposal counts) in parallel — same
 * base-then-relations shape as fetchProjectsWithRelations
 * (lib/data/projects/index.ts).
 */
export async function fetchAgentSessionsOverview(createdBy?: string): Promise<AgentSessionListItem[]> {
  const sessions = await listAgentSessions(createdBy)
  if (sessions.length === 0) return []

  const sessionIds = sessions.map(session => session.id)
  const directClientIds = sessions
    .map(session => session.clientId)
    .filter((id): id is string => Boolean(id))
  const projectIds = sessions
    .map(session => session.projectId)
    .filter((id): id is string => Boolean(id))

  const [pendingCounts, projectSummaries, lastUserMessages] = await Promise.all([
    countPendingProposalsBySession(sessionIds),
    listProjectSummariesByIds(projectIds),
    getLastUserMessagePerSession(sessionIds),
  ])

  const projectClientIds = Array.from(projectSummaries.values())
    .map(project => project.clientId)
    .filter((id): id is string => Boolean(id))
  const lastUserIds = Array.from(lastUserMessages.values()).map(entry => entry.userId)
  const [clientNames, userSummaries] = await Promise.all([
    listClientNamesByIds(Array.from(new Set([...directClientIds, ...projectClientIds]))),
    listUserSummariesByIds(Array.from(new Set(lastUserIds))),
  ])

  return sessions.map(session => ({
    id: session.id,
    title: session.title,
    status: session.status,
    turnStatus: session.turnStatus,
    clientId: session.clientId,
    projectId: session.projectId,
    scopeLabel: resolveScopeLabel(session, projectSummaries, clientNames),
    pendingProposalCount: pendingCounts.get(session.id) ?? 0,
    lastUser: toAuthor(userSummaries.get(lastUserMessages.get(session.id)?.userId ?? '')),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }))
}

function resolveScopeLabel(
  session: { clientId: string | null; projectId: string | null },
  projectSummaries: Map<string, { name: string; clientId: string | null }>,
  clientNames: Map<string, string>
): string | null {
  if (session.projectId) {
    const project = projectSummaries.get(session.projectId)
    if (!project) return null
    const clientName = project.clientId ? clientNames.get(project.clientId) : null
    return clientName ? `${clientName} / ${project.name}` : project.name
  }

  if (session.clientId) {
    const clientName = clientNames.get(session.clientId)
    return clientName ? `All ${clientName} projects` : null
  }

  return null
}

export type AgentSessionDetail = {
  session: {
    id: string
    title: string | null
    turnStatus: AgentSessionTurnStatus
    scopeLabel: string | null
    clientId: string | null
    projectId: string | null
    createdAt: string
  }
  messages: AgentMessageRow[]
  proposedTasks: AgentProposedTask[]
  sessionTasks: AgentSessionTaskRow[]
  projectOptions: Array<{ id: string; name: string }>
  repoLinksByProject: Record<string, GitHubRepoLinkSummary[]>
  pickerTasks: AgentTaskSummary[]
}

const PICKER_TASK_LIMIT = 200

/**
 * Full detail for the Agents workspace's right-pane session view — loaded
 * once when a session is selected (see useAgentSessionDetail). Live
 * turn/message state is handled separately by useAgentSessionState's poll.
 */
export async function fetchAgentSessionDetail(
  user: AppUser,
  sessionId: string
): Promise<AgentSessionDetail> {
  const session = await getAgentSessionById(sessionId)
  if (!session) {
    throw new NotFoundError('Session not found')
  }

  const [messageRows, proposedTasks, sessionTasks, projects, pickerTaskRows] = await Promise.all([
    getSessionMessages(sessionId),
    listProposedTasksForSession(sessionId),
    listSessionTasks(sessionId),
    fetchProjectsWithRelations(),
    listTasksForCli(user, { limit: PICKER_TASK_LIMIT }),
  ])

  const authorIds = messageRows.map(row => row.userId).filter((id): id is string => Boolean(id))
  const authorSummaries = await listUserSummariesByIds(Array.from(new Set(authorIds)))
  const messages: AgentMessageRow[] = messageRows.map(row => ({
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt,
    author: row.userId ? toAuthor(authorSummaries.get(row.userId)) : null,
  }))

  const projectOptions = projects.map(project => ({ id: project.id, name: project.name }))
  const repoLinksByProject = buildRepoLinksByProject(projects)

  const linkedTaskIds = new Set(sessionTasks.map(row => row.task.id))
  const pickerTasks = pickerTaskRows
    .filter(task => !linkedTaskIds.has(task.id))
    .map(task => ({ id: task.id, title: task.title, status: task.status, projectId: task.projectId }))

  const scopedProject = session.projectId ? projects.find(project => project.id === session.projectId) : null
  const projectSummaries = new Map(
    scopedProject ? [[scopedProject.id, { name: scopedProject.name, clientId: scopedProject.client_id }]] : []
  )
  const clientNames = await listClientNamesByIds(
    [session.clientId, scopedProject?.client_id ?? null].filter((clientId): clientId is string => Boolean(clientId))
  )
  const scopeLabel = resolveScopeLabel(session, projectSummaries, clientNames)

  return {
    session: {
      id: session.id,
      title: session.title,
      turnStatus: session.turnStatus,
      scopeLabel,
      clientId: session.clientId,
      projectId: session.projectId,
      createdAt: session.createdAt,
    },
    messages,
    proposedTasks,
    sessionTasks,
    projectOptions,
    repoLinksByProject,
    pickerTasks,
  }
}

function buildRepoLinksByProject(projects: ProjectWithRelations[]) {
  return Object.fromEntries(projects.map(project => [project.id, project.githubRepos]))
}
