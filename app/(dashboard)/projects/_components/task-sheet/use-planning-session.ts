'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getOrCreatePlanningSession,
  addPlanThread,
  type PlanningSessionData,
} from '../../actions/planning'

export const PLANNING_SESSION_KEY = 'planning-session'

type ThreadData = PlanningSessionData['threads'][number]

const DEFAULT_MODEL = 'claude-sonnet-4.6'
const DEFAULT_LABEL = 'Sonnet 4.6'

export function usePlanningSession(taskId: string, repoLinkId: string) {
  const queryClient = useQueryClient()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const queryKey = [PLANNING_SESSION_KEY, taskId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await getOrCreatePlanningSession({ taskId, repoLinkId })
      if ('error' in result) throw new Error(result.error)
      return result.data
    },
    staleTime: 30_000,
  })

  // Auto-select first thread or auto-create default thread
  useEffect(() => {
    if (!data) return

    if (data.threads.length > 0 && !activeThreadId) {
      setActiveThreadId(data.threads[0].id)
    }
  }, [data, activeThreadId])

  const threads = data?.threads ?? []
  const sessionId = data?.sessionId ?? null
  const activeThread = threads.find(t => t.id === activeThreadId) ?? null

  const addThread = useCallback(
    async (model: string, modelLabel: string) => {
      if (!sessionId) return null

      const result = await addPlanThread({ sessionId, model, modelLabel })
      if ('error' in result) return null

      // Update cache
      queryClient.setQueryData<PlanningSessionData>(queryKey, prev => {
        if (!prev) return prev
        return { ...prev, threads: [...prev.threads, result.thread] }
      })

      setActiveThreadId(result.thread.id)
      return result.thread
    },
    [sessionId, queryClient, queryKey]
  )

  // Auto-create default thread if session has none
  const createDefaultThread = useCallback(async () => {
    if (!sessionId || threads.length > 0) return null
    return addThread(DEFAULT_MODEL, DEFAULT_LABEL)
  }, [sessionId, threads.length, addThread])

  return {
    sessionId,
    threads,
    activeThread,
    activeThreadId,
    setActiveThreadId,
    addThread,
    createDefaultThread,
    isLoading,
  }
}
