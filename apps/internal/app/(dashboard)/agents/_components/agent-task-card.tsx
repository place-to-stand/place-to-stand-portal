'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ExternalLink, Loader2, Play, StopCircle } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pts/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import type { GitHubRepoLinkSummary } from '@/lib/types'
import {
  PLANNING_MODEL_TIERS,
  DEFAULT_PLANNING_TIER,
  getModelLabel,
  type PlanningModelTier,
} from '@/lib/planning/models'

import { triggerWorkerPlan, cancelDeployment } from '@/app/(dashboard)/projects/actions/trigger-worker'
import { CompactStatusBadge } from '@/app/(dashboard)/projects/_components/task-sheet/plan-deployments-section'
import { useTaskDeployments, TASK_DEPLOYMENTS_KEY } from '@/app/(dashboard)/projects/_components/task-sheet/use-task-deployments'
import { useWorkerStatus } from '@/app/(dashboard)/projects/_components/task-sheet/use-worker-status'
import type { AgentTaskSummary } from '@/lib/agents/types'

const TERMINAL_STATUSES = ['plan_ready', 'pr_created', 'error', 'cancelled']

type AgentTaskCardProps = {
  task: AgentTaskSummary
  addedVia: 'proposal' | 'selected'
  repoLinks: GitHubRepoLinkSummary[]
}

export function AgentTaskCard({ task, addedVia, repoLinks }: AgentTaskCardProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { open: openSheet } = useSheetParams()

  const [repoLinkId, setRepoLinkId] = useState(repoLinks[0]?.id ?? '')
  const [model, setModel] = useState<PlanningModelTier>(DEFAULT_PLANNING_TIER)
  const [isDispatching, startDispatchTransition] = useTransition()
  const [isCancelling, startCancelTransition] = useTransition()

  const { deployments } = useTaskDeployments(task.id, true)
  const latestDeployment = deployments[0] ?? null
  const isPolled = Boolean(latestDeployment && !TERMINAL_STATUSES.includes(latestDeployment.worker_status))
  const { latestStatus, prUrl } = useWorkerStatus(isPolled && latestDeployment ? latestDeployment.id : null)

  const displayStatus = latestStatus ?? latestDeployment?.worker_status ?? null
  const displayPrUrl = prUrl ?? latestDeployment?.pr_url ?? null
  const isDispatchable = !displayStatus || TERMINAL_STATUSES.includes(displayStatus)
  const isCancellable = displayStatus === 'working' || displayStatus === 'implementing'

  const deploymentsQueryKey = useMemo(() => [TASK_DEPLOYMENTS_KEY, task.id], [task.id])

  const handleDispatch = useCallback(() => {
    if (!repoLinkId) return
    startDispatchTransition(async () => {
      const result = await triggerWorkerPlan({
        taskId: task.id,
        repoLinkId,
        model,
        mode: 'execute',
      })
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }
      toast({ title: 'Dispatched', description: 'GitHub issue created and worker notified.' })
      queryClient.invalidateQueries({ queryKey: deploymentsQueryKey })
    })
  }, [repoLinkId, model, task.id, toast, queryClient, deploymentsQueryKey])

  const handleCancel = useCallback(() => {
    if (!latestDeployment) return
    startCancelTransition(async () => {
      const result = await cancelDeployment({ deploymentId: latestDeployment.id })
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }
      toast({ title: 'Dispatch cancelled' })
      queryClient.invalidateQueries({ queryKey: deploymentsQueryKey })
    })
  }, [latestDeployment, toast, queryClient, deploymentsQueryKey])

  return (
    <div className='flex flex-col gap-2 rounded-md border bg-muted px-3 py-2.5'>
      <div className='flex items-start justify-between gap-2'>
        <button
          type='button'
          onClick={() => openSheet('task', task.id)}
          className='min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline'
          title={task.title}
        >
          {task.title}
        </button>
        {displayStatus && <CompactStatusBadge status={displayStatus} />}
      </div>

      {displayPrUrl && (
        <a
          href={displayPrUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex w-fit items-center gap-1 text-xs font-medium text-green-600 hover:underline dark:text-green-400'
        >
          View PR
          <ExternalLink className='h-3 w-3' />
        </a>
      )}

      {isDispatchable && (
        <div className='flex items-center gap-1.5'>
          <Select value={repoLinkId} onValueChange={setRepoLinkId} disabled={isDispatching || repoLinks.length === 0}>
            <SelectTrigger className='h-7 flex-1 text-xs'>
              <SelectValue placeholder='Select repo' />
            </SelectTrigger>
            <SelectContent>
              {repoLinks.map(repo => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.repoFullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' size='sm' className='h-7 shrink-0 gap-1 text-xs' disabled={isDispatching}>
                {getModelLabel(model).split(' ')[0]}
                <ChevronDown className='h-3 w-3 opacity-50' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-36 p-1' align='end'>
              {PLANNING_MODEL_TIERS.map(tier => (
                <button
                  key={tier}
                  className='flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted'
                  onClick={() => setModel(tier)}
                >
                  {getModelLabel(tier)}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button
            size='sm'
            className='h-7 shrink-0 text-xs'
            disabled={isDispatching || !repoLinkId}
            onClick={handleDispatch}
          >
            {isDispatching ? (
              <Loader2 className='h-3 w-3 animate-spin' />
            ) : (
              <Play className='h-3 w-3' />
            )}
          </Button>
        </div>
      )}

      {isCancellable && (
        <Button
          variant='outline'
          size='sm'
          className='h-7 w-fit gap-1 text-xs text-destructive'
          disabled={isCancelling}
          onClick={handleCancel}
        >
          {isCancelling ? <Loader2 className='h-3 w-3 animate-spin' /> : <StopCircle className='h-3 w-3' />}
          Cancel
        </Button>
      )}

      <span className='text-[10px] text-muted-foreground'>
        {addedVia === 'proposal' ? 'Created by agent' : 'Added to session'}
      </span>
    </div>
  )
}
