'use server'

import { z } from 'zod'

import { requireRole } from '@/lib/auth/session'
import { fetchAgentSessionDetail, type AgentSessionDetail } from '@/lib/data/agent-sessions'
import { NotFoundError } from '@/lib/errors/http'

const fetchSchema = z.object({
  sessionId: z.string().uuid(),
})

export type AgentSessionDetailResult = AgentSessionDetail | { error: string }

/**
 * Loaded client-side by useAgentSessionDetail whenever the right-pane
 * selection changes — a plain fetch, not the generic sheet-init route
 * (this is an inline panel swap, not a sheet).
 */
export async function fetchSessionDetail(input: { sessionId: string }): Promise<AgentSessionDetailResult> {
  const user = await requireRole('ADMIN')

  const parsed = fetchSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  try {
    return await fetchAgentSessionDetail(user, parsed.data.sessionId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Session not found.' }
    console.error('fetchSessionDetail error', error)
    return { error: 'Unable to load session.' }
  }
}
