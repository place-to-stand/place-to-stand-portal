'use server'

import { requireRole } from '@/lib/auth/session'
import { fetchAgentSessionsOverview as fetchOverview, type AgentSessionListItem } from '@/lib/data/agent-sessions'
import { ALL_SESSIONS_OWNER } from '../owner-scope'

/**
 * Polled by AgentSessionsList while any session is generating — the
 * dashboard equivalent of useAgentSessionState, scaled to the whole list.
 * `ownerId` is an admin id to scope to their own sessions, or `'all'` for
 * the everyone view — same shape as My Tasks' `assignee` filter.
 */
export async function fetchAgentSessionsOverview(ownerId: string): Promise<AgentSessionListItem[]> {
  await requireRole('ADMIN')
  return fetchOverview(ownerId === ALL_SESSIONS_OWNER ? undefined : ownerId)
}
