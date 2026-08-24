'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchAgentSessionState, type AgentSessionStateResult } from '../actions/session-state'

const POLL_INTERVAL = 1_000

export const AGENT_SESSION_STATE_KEY = 'agent-session-state'

export type AgentSessionStateData = {
  data: AgentSessionStateResult | undefined
  isLoading: boolean
  isGenerating: boolean
  queryKey: readonly string[]
  /**
   * Forces an immediate poll instead of waiting for the interval. Call this
   * right after send() — the interval-based refetch below is gated off
   * once a session goes idle, so nothing would otherwise notice a *new*
   * turn starting until this fires.
   */
  refetch: () => Promise<unknown>
}

/**
 * Polls this session's turn status + latest message while a turn is
 * streaming, stopping once it lands on complete/error — same
 * function-form refetchInterval idiom as useWorkerStatus
 * (projects/_components/task-sheet/use-worker-status.ts). Generation itself
 * runs server-side independent of this poll (see app/api/agents/chat/route.ts),
 * so this hook surviving a navigation-away-and-back is exactly the point.
 */
export function useAgentSessionState(sessionId: string): AgentSessionStateData {
  const queryKey = useMemo(() => [AGENT_SESSION_STATE_KEY, sessionId] as const, [sessionId])

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchAgentSessionState({ sessionId }),
    refetchInterval: query => {
      const result = query.state.data
      if (!result || 'error' in result) return false
      return result.turnStatus === 'streaming' ? POLL_INTERVAL : false
    },
    staleTime: 750,
  })

  const isGenerating = Boolean(data && !('error' in data) && data.turnStatus === 'streaming')

  return { data, isLoading, isGenerating, queryKey, refetch }
}
