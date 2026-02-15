'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  fetchWorkerStatus,
  type WorkerComment,
  type WorkerCommentStatus,
  type WorkerStatusResult,
} from '../../actions/fetch-worker-status'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 10_000
const TERMINAL_STATUSES: WorkerCommentStatus[] = [
  'plan_ready',
  'pr_created',
  'done_no_changes',
  'error',
]

export const WORKER_STATUS_KEY = 'worker-status'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type WorkerStatusData = {
  statusData: WorkerStatusResult | undefined
  isStatusLoading: boolean
  latestStatus: WorkerCommentStatus | null
  prUrl: string | null
  allComments: WorkerComment[]
  isWorking: boolean
  queryKey: readonly string[]
}

export function useWorkerStatus(deploymentId: string | null): WorkerStatusData {
  const queryKey = useMemo(
    () => [WORKER_STATUS_KEY, deploymentId ?? ''] as const,
    [deploymentId]
  )

  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey,
    queryFn: () => fetchWorkerStatus({ deploymentId: deploymentId! }),
    enabled: Boolean(deploymentId),
    refetchInterval: query => {
      const result = query.state.data
      if (!result || 'error' in result) return POLL_INTERVAL
      if (
        result.latestStatus &&
        TERMINAL_STATUSES.includes(result.latestStatus)
      ) {
        return false
      }
      return POLL_INTERVAL
    },
    staleTime: 5_000,
  })

  const workerResult =
    statusData && !('error' in statusData) ? statusData : null
  const latestStatus = workerResult?.latestStatus ?? null
  const prUrl = workerResult?.prUrl ?? null
  const allComments = useMemo(
    () => workerResult?.comments ?? [],
    [workerResult?.comments]
  )
  const isWorking = latestStatus === 'working' || latestStatus === 'implementing'

  return {
    statusData,
    isStatusLoading,
    latestStatus,
    prUrl,
    allComments,
    isWorking,
    queryKey,
  }
}
