'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { DbTaskDeployment } from '@/lib/types'

export const TASK_DEPLOYMENTS_KEY = 'task-deployments'

export type TaskDeploymentsData = {
  deployments: DbTaskDeployment[]
  isLoading: boolean
  queryKey: readonly string[]
}

async function fetchTaskDeployments(
  taskId: string
): Promise<DbTaskDeployment[]> {
  const response = await fetch(`/api/tasks/${taskId}/deployments`)
  const payload = (await response.json().catch(() => null)) as {
    deployments?: DbTaskDeployment[]
    error?: string
  } | null

  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to load deployments.')
  }

  return payload?.deployments ?? []
}

export function useTaskDeployments(
  taskId: string,
  enabled: boolean
): TaskDeploymentsData {
  const queryKey = useMemo(
    () => [TASK_DEPLOYMENTS_KEY, taskId] as const,
    [taskId]
  )

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchTaskDeployments(taskId),
    enabled: enabled && Boolean(taskId),
    staleTime: 10_000,
  })

  const deployments = useMemo(() => data ?? [], [data])

  return { deployments, isLoading, queryKey }
}
