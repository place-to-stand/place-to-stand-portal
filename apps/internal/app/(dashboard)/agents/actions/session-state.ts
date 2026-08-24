'use server'

import { z } from 'zod'

import { requireRole } from '@/lib/auth/session'
import { getAgentSessionState } from '@/lib/queries/agent-sessions'
import type { AgentMessageStatus, AgentSessionTurnStatus } from '@/lib/queries/agent-sessions'

const fetchSchema = z.object({
  sessionId: z.string().uuid(),
})

export type AgentSessionStateResult =
  | {
      turnStatus: AgentSessionTurnStatus
      latestMessage: {
        id: string
        role: string
        content: string
        status: AgentMessageStatus
        createdAt: string
      } | null
    }
  | { error: string }

/**
 * Polled by useAgentSessionState while a turn is generating — the source of
 * truth for "is this session done yet" now that generation runs detached
 * from any one client connection (see app/api/agents/chat/route.ts).
 */
export async function fetchAgentSessionState(input: {
  sessionId: string
}): Promise<AgentSessionStateResult> {
  await requireRole('ADMIN')

  const parsed = fetchSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const state = await getAgentSessionState(parsed.data.sessionId)
  if (!state) return { error: 'Session not found.' }

  return {
    turnStatus: state.turnStatus,
    latestMessage: state.latestMessage
      ? {
          id: state.latestMessage.id,
          role: state.latestMessage.role,
          content: state.latestMessage.content,
          status: state.latestMessage.status,
          createdAt: state.latestMessage.createdAt,
        }
      : null,
  }
}
