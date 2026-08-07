'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useToast } from '@/components/ui/use-toast'

import {
  TIME_LOGS_QUERY_KEY,
  type ProjectTimeLogHistoryDialogParams,
  type TimeLogEntry,
} from './types'

const PAGE_SIZE = 10

export type UseProjectTimeLogHistoryOptions =
  ProjectTimeLogHistoryDialogParams & {
    enabled?: boolean
  }

export type ProjectTimeLogHistoryState = {
  projectLabel: string
  logs: TimeLogEntry[]
  totalCount: number
  isLoading: boolean
  isError: boolean
  refresh: () => void
  showLoadMore: boolean
  loadMore: () => void
  deleteState: {
    pendingEntry: TimeLogEntry | null
    pendingEntryId: string | null
    request: (entry: TimeLogEntry) => void
    cancel: () => void
    confirm: () => void
    isMutating: boolean
  }
}

export function useProjectTimeLogHistory(
  options: UseProjectTimeLogHistoryOptions
): ProjectTimeLogHistoryState {
  const {
    enabled = true,
    projectId,
    projectName,
    clientName,
  } = options

  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [pendingDelete, setPendingDelete] = useState<TimeLogEntry | null>(null)

  const baseQueryKey = useMemo(
    () => [TIME_LOGS_QUERY_KEY, projectId] as const,
    [projectId]
  )

  const queryKey = useMemo(
    () => [...baseQueryKey, visibleCount] as const,
    [baseQueryKey, visibleCount]
  )

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: visibleCount.toString() })
      const response = await fetch(
        `/api/projects/${projectId}/time-logs?${params.toString()}`
      )

      let payload: unknown
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

      const { logs, totalCount } = (payload ?? {}) as {
        logs?: TimeLogEntry[]
        totalCount?: number
      }

      return {
        logs: logs ?? [],
        totalCount: totalCount ?? logs?.length ?? 0,
      }
    },
  })

  const logs = data?.logs ?? []
  const totalCount = data?.totalCount ?? 0
  const showLoadMore = totalCount > logs.length

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/projects/${projectId}/time-logs/${id}`,
        { method: 'DELETE' }
      )

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

        throw new Error(message || 'Unable to delete time log.')
      }

      // PRD 002 section 05: closed-month warning riding the API response.
      const warning =
        typeof payload === 'object' && payload && 'warning' in payload
          ? String((payload as { warning?: unknown }).warning ?? '').trim()
          : ''

      return { warning: warning || null }
    },
    onSuccess: async data => {
      await queryClient.invalidateQueries({ queryKey: baseQueryKey })
      toast({
        title: 'Time entry removed',
        description: 'The log no longer counts toward the burndown total.',
      })
      if (data?.warning) {
        toast({
          title: 'Closed month',
          description: data.warning,
          variant: 'destructive',
        })
      }
      setPendingDelete(null)
      router.refresh()
    },
    onError: error => {
      console.error('Failed to delete time log', error)
      toast({
        title: 'Could not delete time log',
        description: 'Please try again. If the issue persists contact support.',
        variant: 'destructive',
      })
    },
  })

  const loadMore = useCallback(() => {
    if (isLoading) {
      return
    }
    setVisibleCount(count => count + PAGE_SIZE)
  }, [isLoading])

  const refresh = useCallback(() => {
    void refetch()
  }, [refetch])

  const projectLabel = useMemo(() => {
    return clientName ? `${projectName} · ${clientName}` : projectName
  }, [clientName, projectName])

  const pendingEntryId = pendingDelete?.id ?? null

  const requestDelete = useCallback((entry: TimeLogEntry) => {
    setPendingDelete(entry)
  }, [])

  const cancelDelete = useCallback(() => {
    if (deleteLog.isPending) {
      return
    }
    setPendingDelete(null)
  }, [deleteLog.isPending])

  const confirmDelete = useCallback(() => {
    if (!pendingEntryId || deleteLog.isPending) {
      return
    }
    deleteLog.mutate(pendingEntryId)
  }, [deleteLog, pendingEntryId])

  return {
    projectLabel,
    logs,
    totalCount,
    isLoading,
    isError,
    refresh,
    showLoadMore,
    loadMore,
    deleteState: {
      pendingEntry: pendingDelete,
      pendingEntryId,
      request: requestDelete,
      cancel: cancelDelete,
      confirm: confirmDelete,
      isMutating: deleteLog.isPending,
    },
  }
}
