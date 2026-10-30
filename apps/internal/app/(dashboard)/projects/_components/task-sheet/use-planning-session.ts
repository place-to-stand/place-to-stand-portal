'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { startPlanningThread } from '../../actions/planning'
import { getModelLabel, type PlanningModelTier } from '@/lib/planning/models'
import type { PlanningSessionData } from '@/lib/planning/types'

const PLANNING_SESSION_KEY = 'planning-session'

// While any thread is mid-generation, poll so a client that had this
// session closed (or never open) picks up the in-progress/finished state
// instead of only finding out on next manual refetch.
const GENERATION_POLL_INTERVAL = 2_000

async function fetchPlanningSession(
  taskId: string
): Promise<PlanningSessionData | null> {
  const response = await fetch(`/api/tasks/${taskId}/planning`)
  const payload = (await response.json().catch(() => null)) as {
    session?: PlanningSessionData | null
    error?: string
  } | null

  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to load planning.')
  }

  return payload?.session ?? null
}

/**
 * The task's planning session, read-only until the user acts. Opening the
 * panel only reads; a task that has never been planned comes back with no
 * session and no threads, and `ensureThread` creates both on the first
 * explicit action (Start planning).
 */
export function usePlanningSession(taskId: string, repoLinkId: string) {
  const queryClient = useQueryClient()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const queryKey = useMemo(() => [PLANNING_SESSION_KEY, taskId], [taskId])

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchPlanningSession(taskId),
    staleTime: 30_000,
    refetchInterval: query => {
      const result = query.state.data as PlanningSessionData | null | undefined
      const isAnyThreadStreaming = result?.threads.some(
        t => t.generationStatus === 'streaming'
      )
      return isAnyThreadStreaming ? GENERATION_POLL_INTERVAL : false
    },
  })

  const threads = useMemo(() => data?.threads ?? [], [data])
  const sessionId = data?.sessionId ?? null
  // Derive effective thread ID: explicit selection, or fall back to first thread
  const effectiveThreadId = activeThreadId ?? threads[0]?.id ?? null
  const activeThread = threads.find(t => t.id === effectiveThreadId) ?? null

  /**
   * The active thread's id, creating the session and a thread first when the
   * task has none. Returns an error message instead when that fails.
   */
  const ensureThread = useCallback(
    async (
      model: PlanningModelTier
    ): Promise<{ threadId: string } | { error: string }> => {
      if (effectiveThreadId) {
        return { threadId: effectiveThreadId }
      }

      const result = await startPlanningThread({
        taskId,
        repoLinkId,
        model,
        modelLabel: getModelLabel(model),
      })

      if ('error' in result) {
        return { error: result.error }
      }

      queryClient.setQueryData<PlanningSessionData | null>(queryKey, prev => ({
        sessionId: result.sessionId,
        threads: [...(prev?.threads ?? []), result.thread],
      }))
      setActiveThreadId(result.thread.id)

      return { threadId: result.thread.id }
    },
    [effectiveThreadId, queryClient, queryKey, repoLinkId, taskId]
  )

  return {
    sessionId,
    threads,
    activeThread,
    activeThreadId: effectiveThreadId,
    setActiveThreadId,
    ensureThread,
    isLoading,
  }
}
