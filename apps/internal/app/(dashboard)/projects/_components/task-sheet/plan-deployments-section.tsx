'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  ExternalLink,
  GitPullRequestArrow,
  Loader2,
  StopCircle,
  Terminal,
} from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { BADGE_TINTS } from '@pts/ui/badge-tints'
import { Button } from '@pts/ui/button'
import { cn } from '@pts/ui/cn'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import type { DbTaskDeployment } from '@/lib/types'
import type { WorkerCommentStatus } from '../../actions/fetch-worker-status'
import { cancelDeployment } from '../../actions/trigger-worker'
import { useWorkerStatus } from './use-worker-status'
import {
  useTaskDeployments,
  TASK_DEPLOYMENTS_KEY,
} from './use-task-deployments'

// ---------------------------------------------------------------------------
// Terminal statuses that don't need polling
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES: string[] = [
  'plan_ready',
  'pr_created',
  'error',
  'cancelled',
]

// ---------------------------------------------------------------------------
// Compact status badge (matches deployment-card WorkerStatusBadge)
// ---------------------------------------------------------------------------

function CompactStatusBadge({
  status,
}: {
  status: WorkerCommentStatus | string
}) {
  switch (status) {
    case 'dispatched':
      return (
        <Badge variant='secondary' className='gap-1 text-[10px]'>
          Dispatched
        </Badge>
      )
    case 'working':
    case 'implementing':
      return (
        <Badge variant='secondary' className='gap-1 text-[10px]'>
          <Loader2 className='h-2.5 w-2.5 animate-spin' />
          Executing
        </Badge>
      )
    case 'pr_created':
      return (
        <Badge
          variant='outline'
          className={cn(BADGE_TINTS.emerald, 'text-[10px]')}
        >
          PR created
        </Badge>
      )
    case 'error':
      return (
        <Badge variant='destructive' className='text-[10px]'>
          Error
        </Badge>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard button (tiny, inline)
// ---------------------------------------------------------------------------

function CopyButton({
  value,
  label,
  icon: Icon,
}: {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [value])

  return (
    <Tooltip open={copied || hovered} onOpenChange={setHovered}>
      <TooltipTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          onClick={handleCopy}
          aria-label={label}
          className='text-muted-foreground'
        >
          {copied ? <Check className='text-success' /> : <Icon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? value : label}</TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Single deployment row
// ---------------------------------------------------------------------------

function DeploymentRow({
  deployment,
  isPolled,
  onCancel,
  isCancelling,
}: {
  deployment: DbTaskDeployment
  isPolled: boolean
  onCancel: (deploymentId: string) => void
  isCancelling: boolean
}) {
  // Only poll the row that's marked as polled
  const { latestStatus, prUrl } = useWorkerStatus(
    isPolled ? deployment.id : null
  )

  const displayStatus = latestStatus ?? deployment.worker_status
  const displayPrUrl = prUrl ?? deployment.pr_url ?? null
  const isCancellable =
    displayStatus === 'working' || displayStatus === 'implementing'

  return (
    <div className='group/deploy-row bg-background/60 flex items-center gap-2 rounded-md border px-2.5 py-1.5'>
      {/* Plan ID */}
      <span className='text-muted-foreground shrink-0 font-mono text-[11px]'>
        {deployment.plan_id}
      </span>

      {/* Status badge */}
      <CompactStatusBadge status={displayStatus} />

      {/* GitHub issue link */}
      <a
        href={deployment.github_issue_url}
        target='_blank'
        rel='noopener noreferrer'
        className='text-muted-foreground hover:text-foreground shrink-0 text-xs'
      >
        #{deployment.github_issue_number}
        <ExternalLink className='ml-0.5 inline h-3 w-3' />
      </a>

      {/* PR link + copy buttons (for pr_created status) */}
      {displayPrUrl && (
        <div className='inline-flex shrink-0 items-center gap-1'>
          <a
            href={displayPrUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-success inline-flex items-center gap-1 text-xs font-medium hover:underline'
          >
            <GitPullRequestArrow className='h-3.5 w-3.5' />
            PR
          </a>
          <CopyButton value={displayPrUrl} label='Copy PR URL' icon={Copy} />
          <CopyButton
            value={`git pull ${displayPrUrl}`}
            label='Copy git pull command'
            icon={Terminal}
          />
        </div>
      )}

      {/* Spacer */}
      <span className='flex-1' />

      {/* Cancel button (working/implementing) */}
      {isCancellable && (
        <RowActionButton
          label='Cancel dispatch'
          onClick={() => onCancel(deployment.id)}
          disabled={isCancelling}
          className='text-destructive hover:text-destructive/80 shrink-0'
          icon={
            isCancelling ? <Loader2 className='animate-spin' /> : <StopCircle />
          }
        />
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
  const [isCancelPending, startCancelTransition] = useTransition()

  const deploymentsQueryKey = useMemo(
    () => [TASK_DEPLOYMENTS_KEY, taskId],
    [taskId]
  )

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
  const polledDeploymentId =
    deployments.find(d => !TERMINAL_STATUSES.includes(d.worker_status))?.id ??
    null

  const handleCancelDeployment = useCallback(
    (deploymentId: string) => {
      startCancelTransition(async () => {
        const result = await cancelDeployment({ deploymentId })
        if ('error' in result) {
          toast({
            variant: 'destructive',
            title: 'Unable to cancel dispatch',
            description: result.error,
          })
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
    <div className='bg-muted/30 flex flex-col gap-1.5 border-b px-4 py-2'>
      {visibleDeployments.map(deployment => (
        <DeploymentRow
          key={deployment.id}
          deployment={deployment}
          isPolled={deployment.id === polledDeploymentId}
          onCancel={handleCancelDeployment}
          isCancelling={isCancelPending}
        />
      ))}
      {!showAll && hiddenCount > 0 && (
        <Button
          type='button'
          variant='ghost'
          size='xs'
          onClick={() => setShowAll(true)}
          className='text-muted-foreground'
        >
          + {hiddenCount} more dispatch{hiddenCount > 1 ? 'es' : ''}
        </Button>
      )}
    </div>
  )
}
