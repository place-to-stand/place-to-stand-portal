'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  ExternalLink,
  Github,
  Info,
  Loader2,
  Play,
  X,
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

import { triggerWorkerPlan, triggerWorkerImplement, cancelDeployment } from '../../actions/trigger-worker'
import type { WorkerCommentStatus, WorkerStatusResult } from '../../actions/fetch-worker-status'

import type { GitHubRepoLinkSummary, TaskWithRelations } from '@/lib/types'
import { useTaskDeployments } from './use-task-deployments'
import { useWorkerStatus, WORKER_STATUS_KEY } from './use-worker-status'
import { DeploymentCard } from './deployment-card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkerModel = 'opus' | 'sonnet' | 'haiku'
type DeployMode = 'plan' | 'execute'

const TERMINAL_STATUSES: WorkerCommentStatus[] = [
  'plan_ready',
  'pr_created',
  'done_no_changes',
  'error',
  'cancelled',
]

type DeploymentPanelProps = {
  task: TaskWithRelations
  githubRepos: GitHubRepoLinkSummary[]
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeploymentPanel({ task, githubRepos, onClose }: DeploymentPanelProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedRepoId, setSelectedRepoId] = useState<string>(
    githubRepos[0]?.id ?? ''
  )
  const [model, setModel] = useState<WorkerModel>('sonnet')
  const [deployMode, setDeployMode] = useState<DeployMode>('plan')
  const [isPlanPending, startPlanTransition] = useTransition()
  const [isImplPending, startImplTransition] = useTransition()
  const [isCancelPending, startCancelTransition] = useTransition()

  // Track the active deployment ID for polling (optimistic or from list)
  const [optimisticDeploymentId, setOptimisticDeploymentId] = useState<string | null>(null)

  // Fetch all deployments for this task
  const { deployments, isLoading: isDeploymentsLoading, queryKey: deploymentsQueryKey } =
    useTaskDeployments(task.id, true)

  // Determine which deployment to poll
  const activeDeploymentId = useMemo(() => {
    // If we have an optimistic ID from a just-created deployment, use that
    if (optimisticDeploymentId) return optimisticDeploymentId

    // Otherwise find the first non-terminal deployment
    for (const d of deployments) {
      if (!TERMINAL_STATUSES.includes(d.worker_status as WorkerCommentStatus)) {
        return d.id
      }
    }

    return null
  }, [optimisticDeploymentId, deployments])

  // Poll for worker status on the active deployment
  const workerStatus = useWorkerStatus(activeDeploymentId)

  const isPending = isPlanPending || isImplPending
  const selectedRepo = githubRepos.find(r => r.id === selectedRepoId)

  // Latest status for the header badge
  const headerStatus = workerStatus.latestStatus ?? (deployments[0]?.worker_status as WorkerCommentStatus | undefined) ?? null

  // ---- Handlers ----

  const handleDeploy = useCallback(() => {
    startPlanTransition(async () => {
      const result = await triggerWorkerPlan({
        taskId: task.id,
        repoLinkId: selectedRepoId,
        model,
        mode: deployMode,
      })

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }

      // Track the new deployment for immediate polling
      setOptimisticDeploymentId(result.deploymentId)

      // Optimistically seed worker status so polling resumes
      const optimisticStatus: WorkerCommentStatus = deployMode === 'execute' ? 'implementing' : 'working'
      queryClient.setQueryData<WorkerStatusResult>(
        [WORKER_STATUS_KEY, result.deploymentId],
        { comments: [], prUrl: null, latestStatus: optimisticStatus }
      )

      const desc =
        deployMode === 'execute'
          ? 'GitHub issue created. Worker is executing...'
          : 'GitHub issue created. Worker is planning...'
      toast({ title: 'Deploy started', description: desc })

      // Refresh deployment list
      queryClient.invalidateQueries({ queryKey: deploymentsQueryKey })
    })
  }, [task.id, selectedRepoId, model, deployMode, toast, queryClient, deploymentsQueryKey])

  const handleAcceptPlan = useCallback((deploymentId: string, acceptModel: WorkerModel) => {
    startImplTransition(async () => {
      const result = await triggerWorkerImplement({
        deploymentId,
        model: acceptModel,
      })

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }

      // Optimistically update status so polling resumes
      queryClient.setQueryData<WorkerStatusResult>(
        [WORKER_STATUS_KEY, deploymentId],
        prev => {
          if (!prev || 'error' in prev) {
            return { comments: [], prUrl: null, latestStatus: 'implementing' as const }
          }
          return { ...prev, latestStatus: 'implementing' as const }
        }
      )

      toast({ title: 'Implementation requested', description: 'Worker is executing...' })
      queryClient.invalidateQueries({ queryKey: [WORKER_STATUS_KEY, deploymentId] })
      queryClient.invalidateQueries({ queryKey: deploymentsQueryKey })
    })
  }, [toast, queryClient, deploymentsQueryKey])

  const handleCancel = useCallback((deploymentId: string) => {
    startCancelTransition(async () => {
      const result = await cancelDeployment({ deploymentId })

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }

      // Optimistically update status
      queryClient.setQueryData<WorkerStatusResult>(
        [WORKER_STATUS_KEY, deploymentId],
        prev => {
          if (!prev || 'error' in prev) {
            return { comments: [], prUrl: null, latestStatus: 'cancelled' as const }
          }
          return { ...prev, latestStatus: 'cancelled' as const }
        }
      )

      toast({ title: 'Deployment cancelled', description: 'Cancel signal sent to worker.' })
      queryClient.invalidateQueries({ queryKey: [WORKER_STATUS_KEY, deploymentId] })
      queryClient.invalidateQueries({ queryKey: deploymentsQueryKey })
    })
  }, [toast, queryClient, deploymentsQueryKey])

  return (
    <div className='flex h-full w-[560px] shrink-0 flex-col border-l'>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <div className='flex items-center gap-2'>
          <Bot className='h-4 w-4' />
          <span className='text-sm font-semibold'>Deployment</span>
          {headerStatus && <HeaderStatusBadge status={headerStatus} />}
        </div>
        <Button variant='ghost' size='icon' className='h-7 w-7' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className='flex-1 overflow-y-auto px-4'>
        {/* New Plan controls — always visible */}
        <div className='flex flex-col gap-4 py-2'>
          {/* Repo selector */}
          {githubRepos.length > 1 ? (
            <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
              <SelectTrigger className='h-8 text-xs'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {githubRepos.map(repo => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.repoFullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : selectedRepo ? (
            <a
              href={`https://github.com/${selectedRepo.repoFullName}`}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
            >
              <Github className='h-3.5 w-3.5' />
              {selectedRepo.repoFullName}
              <ExternalLink className='h-3 w-3' />
            </a>
          ) : null}

          {/* Context hint */}
          <div className='flex gap-2 rounded-md border bg-muted/40 px-3 py-2'>
            <Info className='mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground' />
            <div className='text-xs text-muted-foreground'>
              <p>
                The task <span className='font-medium text-foreground'>Title</span> and{' '}
                <span className='font-medium text-foreground'>Description</span> will be sent to the worker.
              </p>
              {!task.description?.trim() && (
                <p className='mt-1 text-amber-600 dark:text-amber-400'>
                  No description set — the worker will only have the title for context.
                </p>
              )}
            </div>
          </div>

          {/* Controls row */}
          <div className='flex items-center gap-2'>
            <ModelSelector model={model} onChange={setModel} />
            <ModeSelector mode={deployMode} onChange={setDeployMode} />
            <Button
              size='sm'
              onClick={handleDeploy}
              disabled={isPending || !selectedRepoId}
              className='ml-auto'
            >
              {isPlanPending ? (
                <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
              ) : (
                <Play className='mr-1.5 h-3.5 w-3.5' />
              )}
              Deploy
            </Button>
          </div>
        </div>

        {/* Deployment list */}
        {isDeploymentsLoading && deployments.length === 0 && (
          <div className='flex items-center gap-2 py-4 text-xs text-muted-foreground'>
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
            Loading deployments...
          </div>
        )}

        {deployments.length > 0 && (
          <div className='flex flex-col gap-3 pt-4 pb-4'>
            <h4 className='text-sm font-medium text-muted-foreground'>
              Deployments ({deployments.length})
            </h4>
            {deployments.map(deployment => {
              const isActiveDeployment = deployment.id === activeDeploymentId
              return (
                <DeploymentCard
                  key={deployment.id}
                  deployment={deployment}
                  workerStatusData={isActiveDeployment ? workerStatus : null}
                  isActive={isActiveDeployment}
                  onAcceptPlan={handleAcceptPlan}
                  isAccepting={isImplPending}
                  onCancel={handleCancel}
                  isCancelling={isCancelPending}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModelSelector({
  model,
  onChange,
}: {
  model: WorkerModel
  onChange: (m: WorkerModel) => void
}) {
  return (
    <Select value={model} onValueChange={v => onChange(v as WorkerModel)}>
      <SelectTrigger className='h-8 w-[110px] text-xs'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='opus'>Opus</SelectItem>
        <SelectItem value='sonnet'>Sonnet</SelectItem>
        <SelectItem value='haiku'>Haiku</SelectItem>
      </SelectContent>
    </Select>
  )
}

function ModeSelector({
  mode,
  onChange,
}: {
  mode: DeployMode
  onChange: (m: DeployMode) => void
}) {
  return (
    <Select value={mode} onValueChange={v => onChange(v as DeployMode)}>
      <SelectTrigger className='h-8 w-[110px] text-xs'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='plan'>Plan</SelectItem>
        <SelectItem value='execute'>Execute</SelectItem>
      </SelectContent>
    </Select>
  )
}

function HeaderStatusBadge({ status }: { status: WorkerCommentStatus }) {
  switch (status) {
    case 'working':
      return <Badge variant='secondary' className='text-[10px]'>Planning</Badge>
    case 'implementing':
      return <Badge variant='secondary' className='text-[10px]'>Executing</Badge>
    case 'plan_ready':
      return <Badge className='bg-blue-100 text-blue-800 text-[10px] dark:bg-blue-900 dark:text-blue-200'>Plan Ready</Badge>
    case 'pr_created':
      return <Badge className='bg-green-100 text-green-800 text-[10px] dark:bg-green-900 dark:text-green-200'>PR Created</Badge>
    case 'done_no_changes':
      return <Badge variant='secondary' className='text-[10px]'>Done</Badge>
    case 'error':
      return <Badge variant='destructive' className='text-[10px]'>Error</Badge>
    case 'cancelled':
      return <Badge className='bg-orange-100 text-orange-800 text-[10px] dark:bg-orange-900 dark:text-orange-200'>Cancelled</Badge>
    default:
      return null
  }
}
