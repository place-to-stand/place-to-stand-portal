'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { TimeLogEntry } from '@/lib/projects/time-log/types'

export const TASK_TIME_LOGS_KEY = 'task-time-logs'

export type TaskTimeLogsData = {
  entries: TimeLogEntry[]
  totalHours: number
  isLoading: boolean
  isError: boolean
  queryKey: readonly string[]
}

export function useTaskTimeLogs(
  taskId: string,
  enabled: boolean
): TaskTimeLogsData {
  const queryKey = useMemo(
    () => [TASK_TIME_LOGS_KEY, taskId] as const,
    [taskId]
  )

  const { data, isLoading, isError } = useQuery({
    queryKey,
    enabled: enabled && Boolean(taskId),
    // Logs change from other surfaces (Time Logs tab, burndown widget) — the
    // global default of 60s would serve stale lists, so opt out explicitly.
    staleTime: 0,
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${taskId}/time-logs`)

      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload && 'error' in payload
            ? String((payload as { error?: unknown }).error ?? '').trim()
            : ''

        throw new Error(message || 'Unable to load time logs.')
      }

      const { entries, totalHours } = (payload ?? {}) as {
        entries?: TimeLogEntry[]
        totalHours?: number
      }

      return {
        entries: entries ?? [],
        totalHours: totalHours ?? 0,
      }
    },
  })

  return {
    entries: data?.entries ?? [],
    totalHours: data?.totalHours ?? 0,
    isLoading,
    isError,
    queryKey,
  }
}
