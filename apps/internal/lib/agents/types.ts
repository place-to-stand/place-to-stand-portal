export type AgentSessionTurnStatus = 'idle' | 'streaming' | 'error'
export type AgentMessageStatus = 'streaming' | 'complete' | 'error'

/** A task as referenced from the agents workspace — linked, proposed-source, or browsable. */
export type AgentTaskSummary = {
  id: string
  title: string
  status: string
  projectId: string
}

export type AgentMessageAuthor = {
  id: string
  name: string
  avatarUrl: string | null
}

export type AgentMessageRow = {
  id: string
  role: string
  content: string
  status: AgentMessageStatus
  createdAt: string
  /** Who sent this — sessions are shared among admins. Null for assistant messages. */
  author: AgentMessageAuthor | null
}

export type AgentProposedTask = {
  id: string
  title: string
  description: string | null
  status: 'proposed' | 'accepted' | 'rejected'
  projectId: string | null
}

export type AgentSessionTaskRow = {
  id: string
  addedVia: 'proposal' | 'selected'
  task: AgentTaskSummary
}
