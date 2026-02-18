'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  GitPullRequestArrow,
  Loader2,
  Play,
  StopCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { DbTaskDeployment } from '@/lib/types'
import type { WorkerCommentStatus } from '../../actions/fetch-worker-status'
import { triggerWorkerImplement, cancelDeployment } from '../../actions/trigger-worker'
import { useWorkerStatus } from './use-worker-status'
import { useTaskDeployments, TASK_DEPLOYMENTS_KEY } from './use-task-deployments'

// ---------------------------------------------------------------------------
// Terminal statuses that don't need polling
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES: string[] = [
  'plan_ready',
  'pr_created',
  'done_no_changes',
  'error',
  'cancelled',
]

// ---------------------------------------------------------------------------
// Compact status badge (matches deployment-card WorkerStatusBadge)
// ---------------------------------------------------------------------------

function CompactStatusBadge({ status }: { status: WorkerCommentStatus | string }) {
  switch (status) {
    case 'working':
      return (
        <Badge variant='secondary' className='gap-1 text-[10px]'>
          <Loader2 className='h-2.5 w-2.5 animate-spin' />
          Planning
        </Badge>
      )
    case 'implementing':
      return (
        <Badge variant='secondary' className='gap-1 text-[10px]'>
          <Loader2 className='h-2.5 w-2.5 animate-spin' />
          Executing
        </Badge>
      )
    case 'plan_ready':
      return (
        <Badge className='bg-blue-100 text-blue-800 text-[10px] dark:bg-blue-900 dark:text-blue-200'>
          Plan Ready
        </Badge>
      )
    case 'pr_created':
      return (
        <Badge className='bg-green-100 text-green-800 text-[10px] dark:bg-green-900 dark:text-green-200'>
          PR Created
        </Badge>
      )
    case 'done_no_changes':
      return <Badge variant='secondary' className='text-[10px]'>Done</Badge>
    case 'error':
      return <Badge variant='destructive' className='text-[10px]'>Error</Badge>
    case 'cancelled':
      return (
        <Badge className='bg-orange-100 text-orange-800 text-[10px] dark:bg-orange-900 dark:text-orange-200'>
          Cancelled
        </Badge>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Single deployment row
// ---------------------------------------------------------------------------

type WorkerModel = 'opus' | 'sonnet' | 'haiku'

function DeploymentRow({
  deployment,
  isPolled,
  onAcceptPlan,
  isAccepting,
  onCancel,
  isCancelling,
}: {
  deployment: DbTaskDeployment
  isPolled: boolean
  onAcceptPlan: (deploymentId: string, model: WorkerModel) => void
  isAccepting: boolean
  onCancel: (deploymentId: string) => void
  isCancelling: boolean
}) {
  const [model, setModel] = useState<WorkerModel>('sonnet')

  // Only poll the row that's marked as polled
  const { latestStatus, prUrl } = useWorkerStatus(isPolled ? deployment.id : null)

  const displayStatus = latestStatus ?? deployment.worker_status
  const displayPrUrl = prUrl ?? deployment.pr_url ?? null
  const isCancellable = displayStatus === 'working' || displayStatus === 'implementing'
  const isPlanReady = displayStatus === 'plan_ready'

  return (
    <div className='group/deploy-row flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5'>
      {/* Plan ID */}
      <span className='shrink-0 font-mono text-[11px] text-muted-foreground'>
        {deployment.plan_id}
      </span>

      {/* Status badge */}
      <CompactStatusBadge status={displayStatus} />

      {/* GitHub issue link */}
      <a
        href={deployment.github_issue_url}
        target='_blank'
        rel='noopener noreferrer'
        className='shrink-0 text-xs text-muted-foreground hover:text-foreground'
      >
        #{deployment.github_issue_number}
        <ExternalLink className='ml-0.5 inline h-3 w-3' />
      </a>

      {/* PR link (for pr_created status) */}
      {displayPrUrl && (
        <a
          href={displayPrUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-600 hover:underline dark:text-green-400'
        >
          <GitPullRequestArrow className='h-3.5 w-3.5' />
          PR
        </a>
      )}

      {/* Spacer */}
      <span className='flex-1' />

      {/* Accept plan controls (plan_ready) */}
      {isPlanReady && (
        <div className='flex items-center gap-1'>
          <Select value={model} onValueChange={v => setModel(v as WorkerModel)}>
            <SelectTrigger className='h-6 w-[80px] text-[10px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='opus'>Opus</SelectItem>
              <SelectItem value='sonnet'>Sonnet</SelectItem>
              <SelectItem value='haiku'>Haiku</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size='sm'
            className='h-6 gap-1 text-[10px]'
            onClick={() => onAcceptPlan(deployment.id, model)}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <Loader2 className='h-3 w-3 animate-spin' />
            ) : (
              <Play className='h-3 w-3' />
            )}
            Execute
          </Button>
        </div>
      )}

      {/* Cancel button (working/implementing) */}
      {isCancellable && (
        <button
          type='button'
          onClick={() => onCancel(deployment.id)}
          disabled={isCancelling}
          className='inline-flex shrink-0 items-center text-destructive hover:text-destructive/80 disabled:opacity-50'
          title='Cancel dispatch'
        >
          {isCancelling ? (
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
          ) : (
            <StopCircle className='h-3.5 w-3.5' />
          )}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlanDeploymentStatus — compact inline deployment list
// ---------------------------------------------------------------------------

const DEFAULT_VISIBLE = 2

type PlanDeploymentStatusProps = {
  taskId: string
  /** Current thread ID being viewed in the planning panel */
  activeThreadId: string | null
  /** Current plan version being viewed */
  currentVersion: number
}

export function PlanDeploymentStatus({
  taskId,
  activeThreadId,
  currentVersion,
}: PlanDeploymentStatusProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { deployments: allDeployments } = useTaskDeployments(taskId, true)
  const [showAll, setShowAll] = useState(false)
  const [isImplPending, startImplTransition] = useTransition()
  const [isCancelPending, startCancelTransition] = useTransition()

  const deploymentsQueryKey = [TASK_DEPLOYMENTS_KEY, taskId]

  // Filter to only show deployments that match the current thread + version
  const deployments = useMemo(
    () =>
      allDeployments.filter(
        d =>
          d.plan_thread_id === activeThreadId &&
          d.plan_version === currentVersion
      ),
    [allDeployments, activeThreadId, currentVersion]
  )

  // Find the most recent non-terminal deployment for polling
  const polledDeploymentId = deployments.find(
    d => !TERMINAL_STATUSES.includes(d.worker_status)
  )?.id ?? null

  const handleAcceptPlan = useCallback(
    (deploymentId: string, model: WorkerModel) => {
      startImplTransition(async () => {
        const result = await triggerWorkerImplement({ deploymentId, model })
        if ('error' in result) {
          toast({ variant: 'destructive', title: 'Error', description: result.error })
          return
        }
        toast({ title: 'Implementation requested' })
        queryClient.invalidateQueries({ queryKey: deploymentsQueryKey })
      })
    },
    [toast, queryClient, deploymentsQueryKey]
  )

  const handleCancelDeployment = useCallback(
    (deploymentId: string) => {
      startCancelTransition(async () => {
        const result = await cancelDeployment({ deploymentId })
        if ('error' in result) {
          toast({ variant: 'destructive', title: 'Error', description: result.error })
          return
        }
        toast({ title: 'Dispatch cancelled' })
        queryClient.invalidateQueries({ queryKey: deploymentsQueryKey })
      })
    },
    [toast, queryClient, deploymentsQueryKey]
  )

  if (deployments.length === 0) return null

  const visibleDeployments = showAll
    ? deployments
    : deployments.slice(0, DEFAULT_VISIBLE)
  const hiddenCount = deployments.length - DEFAULT_VISIBLE

  return (
    <div className='mt-4 flex flex-col gap-1.5'>
      {visibleDeployments.map(deployment => (
        <DeploymentRow
          key={deployment.id}
          deployment={deployment}
          isPolled={deployment.id === polledDeploymentId}
          onAcceptPlan={handleAcceptPlan}
          isAccepting={isImplPending}
          onCancel={handleCancelDeployment}
          isCancelling={isCancelPending}
        />
      ))}
      {!showAll && hiddenCount > 0 && (
        <button
          type='button'
          onClick={() => setShowAll(true)}
          className='text-xs text-muted-foreground hover:text-foreground'
        >
          + {hiddenCount} more dispatch{hiddenCount > 1 ? 'es' : ''}
        </button>
      )}
    </div>
  )
}
