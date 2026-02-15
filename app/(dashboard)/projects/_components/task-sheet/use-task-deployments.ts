'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchTaskDeployments,
  type FetchDeploymentsResult,
} from '../../actions/fetch-deployments'
import type { DbTaskDeployment } from '@/lib/types'

export const TASK_DEPLOYMENTS_KEY = 'task-deployments'

export type TaskDeploymentsData = {
  deployments: DbTaskDeployment[]
  isLoading: boolean
  queryKey: readonly string[]
}

export function useTaskDeployments(taskId: string, enabled: boolean): TaskDeploymentsData {
  const queryKey = useMemo(
    () => [TASK_DEPLOYMENTS_KEY, taskId] as const,
    [taskId]
  )

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchTaskDeployments({ taskId }),
    enabled: enabled && Boolean(taskId),
    staleTime: 10_000,
  })

  const deployments = useMemo(() => {
    if (!data || 'error' in data) return []
    return data.deployments
  }, [data])

  return { deployments, isLoading, queryKey }
}
