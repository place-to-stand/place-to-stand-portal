'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { AgentSessionDetail } from '@/lib/data/agent-sessions'

import { fetchSessionDetail, type AgentSessionDetailResult } from '../actions/session-detail'

export const AGENT_SESSION_DETAIL_KEY = 'agent-session-detail'

/**
 * Loads a session's static detail (messages, proposals, linked/browsable
 * tasks) whenever the right pane's selection changes — a plain client
 * fetch, cached per session so re-selecting an already-open session is
 * instant. Live turn/message updates are handled separately by
 * useAgentSessionState's poll.
 */
export function useAgentSessionDetail(sessionId: string | null, initialData?: AgentSessionDetail) {
  const queryKey = useMemo(() => [AGENT_SESSION_DETAIL_KEY, sessionId] as const, [sessionId])

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSessionDetail({ sessionId: sessionId! }),
    enabled: Boolean(sessionId),
    initialData: initialData as AgentSessionDetailResult | undefined,
    staleTime: 10_000,
  })

  const detail = data && !('error' in data) ? data : null
  const error = data && 'error' in data ? data.error : null

  return { detail, error, isLoading }
}
