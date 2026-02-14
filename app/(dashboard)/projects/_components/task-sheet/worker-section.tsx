'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  ExternalLink,
  GitPullRequestArrow,
  Loader2,
  Play,
  RefreshCw,
  Send,
  AlertTriangle,
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

import { triggerWorkerPlan, triggerWorkerImplement } from '../../actions/trigger-worker'
import {
  fetchWorkerStatus,
  type WorkerComment,
  type WorkerCommentStatus,
} from '../../actions/fetch-worker-status'

import type { GitHubRepoLinkSummary, TaskWithRelations } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkerModel = 'opus' | 'sonnet' | 'haiku'

type WorkerSectionProps = {
  task: TaskWithRelations
  githubRepos: GitHubRepoLinkSummary[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 10_000 // 10 seconds
const TERMINAL_STATUSES: WorkerCommentStatus[] = [
  'plan_ready',
  'pr_created',
  'done_no_changes',
  'error',
]

const WORKER_STATUS_KEY = 'worker-status'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkerSection({ task, githubRepos }: WorkerSectionProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedRepoId, setSelectedRepoId] = useState<string>(
    githubRepos[0]?.id ?? ''
  )
  const [model, setModel] = useState<WorkerModel>('sonnet')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isPlanPending, startPlanTransition] = useTransition()
  const [isImplPending, startImplTransition] = useTransition()

  const hasIssue = Boolean(task.github_issue_number)

  // Query for worker status (only when issue exists)
  const queryKey = useMemo(
    () => [WORKER_STATUS_KEY, task.id],
    [task.id]
  )

  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey,
    queryFn: () => fetchWorkerStatus({ taskId: task.id }),
    enabled: hasIssue,
    refetchInterval: query => {
      const result = query.state.data
      if (!result || 'error' in result) return POLL_INTERVAL
      if (
        result.latestStatus &&
        TERMINAL_STATUSES.includes(result.latestStatus)
      ) {
        return false // stop polling
      }
      return POLL_INTERVAL
    },
    staleTime: 5_000,
  })

  const workerResult =
    statusData && !('error' in statusData) ? statusData : null
  const latestStatus = workerResult?.latestStatus ?? null
  const prUrl = workerResult?.prUrl ?? null
  const botComments = useMemo(
    () => workerResult?.comments ?? [],
    [workerResult?.comments]
  )

  // Find latest plan comment
  const latestPlanComment = useMemo(() => {
    for (let i = botComments.length - 1; i >= 0; i--) {
      if (botComments[i].status === 'plan_ready') return botComments[i]
    }
    return null
  }, [botComments])

  // Handlers
  const handleStartPlan = useCallback(() => {
    startPlanTransition(async () => {
      const result = await triggerWorkerPlan({
        taskId: task.id,
        repoLinkId: selectedRepoId,
        model,
      })

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }

      toast({ title: 'Plan requested', description: 'GitHub issue created. Worker is planning...' })
      // Invalidate to start polling
      queryClient.invalidateQueries({ queryKey })
    })
  }, [task.id, selectedRepoId, model, toast, queryClient, queryKey])

  const handleAcceptPlan = useCallback(() => {
    startImplTransition(async () => {
      const result = await triggerWorkerImplement({
        taskId: task.id,
        repoLinkId: selectedRepoId,
        model,
      })

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }

      toast({ title: 'Implementation requested', description: 'Worker is implementing...' })
      queryClient.invalidateQueries({ queryKey })
    })
  }, [task.id, selectedRepoId, model, toast, queryClient, queryKey])

  const handleSendCustom = useCallback(() => {
    if (!customPrompt.trim()) return

    startImplTransition(async () => {
      const result = await triggerWorkerImplement({
        taskId: task.id,
        repoLinkId: selectedRepoId,
        model,
        customPrompt: customPrompt.trim(),
      })

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }

      setCustomPrompt('')
      toast({ title: 'Comment posted', description: 'Worker is working...' })
      queryClient.invalidateQueries({ queryKey })
    })
  }, [task.id, selectedRepoId, model, customPrompt, toast, queryClient, queryKey])

  const handleRetry = useCallback(() => {
    handleStartPlan()
  }, [handleStartPlan])

  const isPending = isPlanPending || isImplPending

  // Resolve which repo to show in selector
  const selectedRepo = githubRepos.find(r => r.id === selectedRepoId)

  return (
    <div className='rounded-lg border bg-muted/30 px-4 py-3'>
      <div className='mb-2 flex items-center gap-2 text-sm font-medium'>
        <Bot className='h-4 w-4' />
        Worker
        {latestStatus && <WorkerStatusBadge status={latestStatus} />}
      </div>

      {/* No issue yet — show start plan controls */}
      {!hasIssue && (
        <div className='flex flex-col gap-3'>
          <div className='flex items-center gap-2'>
            {githubRepos.length > 1 && (
              <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
                <SelectTrigger className='h-8 w-[200px] text-xs'>
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
            )}
            {githubRepos.length === 1 && selectedRepo && (
              <span className='text-xs text-muted-foreground'>
                {selectedRepo.repoFullName}
              </span>
            )}
            <ModelSelector model={model} onChange={setModel} />
          </div>
          <Button
            size='sm'
            onClick={handleStartPlan}
            disabled={isPending || !selectedRepoId}
          >
            {isPlanPending ? (
              <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
            ) : (
              <Play className='mr-1.5 h-3.5 w-3.5' />
            )}
            Start Plan
          </Button>
        </div>
      )}

      {/* Issue exists — show status */}
      {hasIssue && (
        <div className='flex flex-col gap-3'>
          {/* Issue link */}
          {task.github_issue_url && (
            <a
              href={task.github_issue_url}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
            >
              Issue #{task.github_issue_number}
              <ExternalLink className='h-3 w-3' />
            </a>
          )}

          {/* Loading state */}
          {isStatusLoading && (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              Loading status...
            </div>
          )}

          {/* Status error from fetch */}
          {statusData && 'error' in statusData && (
            <p className='text-xs text-destructive'>{statusData.error}</p>
          )}

          {/* Working / planning spinner */}
          {(latestStatus === 'working' || latestStatus === 'implementing') && (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              {latestStatus === 'working'
                ? 'Worker is planning...'
                : 'Worker is implementing...'}
            </div>
          )}

          {/* Plan ready — show plan + accept controls */}
          {latestStatus === 'plan_ready' && latestPlanComment && (
            <div className='flex flex-col gap-3'>
              <WorkerPlanDisplay comment={latestPlanComment} />
              <div className='flex items-center gap-2'>
                <ModelSelector model={model} onChange={setModel} />
                <Button
                  size='sm'
                  onClick={handleAcceptPlan}
                  disabled={isPending}
                >
                  {isImplPending ? (
                    <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <Play className='mr-1.5 h-3.5 w-3.5' />
                  )}
                  Accept Plan
                </Button>
              </div>
              <WorkerResponseInput
                value={customPrompt}
                onChange={setCustomPrompt}
                onSend={handleSendCustom}
                disabled={isPending}
              />
            </div>
          )}

          {/* PR created */}
          {prUrl && (
            <a
              href={prUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:underline dark:text-green-400'
            >
              <GitPullRequestArrow className='h-4 w-4' />
              Pull Request
              <ExternalLink className='h-3 w-3' />
            </a>
          )}

          {/* Done with no changes */}
          {latestStatus === 'done_no_changes' && !prUrl && (
            <p className='text-xs text-muted-foreground'>
              Worker completed with no changes.
            </p>
          )}

          {/* Error state */}
          {latestStatus === 'error' && (
            <div className='flex flex-col gap-2'>
              <div className='flex items-center gap-1.5 text-xs text-destructive'>
                <AlertTriangle className='h-3.5 w-3.5' />
                Worker encountered an error.
              </div>
              <Button
                size='sm'
                variant='outline'
                onClick={handleRetry}
                disabled={isPending}
              >
                <RefreshCw className='mr-1.5 h-3.5 w-3.5' />
                Retry
              </Button>
            </div>
          )}

          {/* Unknown status but comments exist — show custom response input */}
          {latestStatus === 'unknown' && botComments.length > 0 && (
            <div className='flex flex-col gap-3'>
              <WorkerResponseInput
                value={customPrompt}
                onChange={setCustomPrompt}
                onSend={handleSendCustom}
                disabled={isPending}
              />
            </div>
          )}

          {/* Always show custom response when plan is NOT the latest but we have an issue and no terminal error */}
          {hasIssue &&
            latestStatus !== 'plan_ready' &&
            latestStatus !== 'error' &&
            latestStatus !== 'working' &&
            latestStatus !== 'implementing' &&
            prUrl && (
              <div className='mt-2'>
                <WorkerResponseInput
                  value={customPrompt}
                  onChange={setCustomPrompt}
                  onSend={handleSendCustom}
                  disabled={isPending}
                />
              </div>
            )}
        </div>
      )}
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

function WorkerStatusBadge({ status }: { status: WorkerCommentStatus }) {
  switch (status) {
    case 'working':
      return (
        <Badge variant='secondary' className='text-[10px]'>
          Planning
        </Badge>
      )
    case 'implementing':
      return (
        <Badge variant='secondary' className='text-[10px]'>
          Implementing
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
      return (
        <Badge variant='secondary' className='text-[10px]'>
          Done
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

function WorkerPlanDisplay({ comment }: { comment: WorkerComment }) {
  return (
    <div className='max-h-[300px] overflow-y-auto rounded border bg-background p-3'>
      <div className='prose prose-sm dark:prose-invert max-w-none text-xs'>
        <pre className='whitespace-pre-wrap text-xs'>{comment.body}</pre>
      </div>
    </div>
  )
}

function WorkerResponseInput({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
}) {
  return (
    <div className='flex gap-2'>
      <Textarea
        placeholder='Custom prompt for worker...'
        value={value}
        onChange={e => onChange(e.target.value)}
        className='min-h-[60px] text-xs'
        disabled={disabled}
      />
      <Button
        size='sm'
        variant='outline'
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className='self-end'
      >
        <Send className='h-3.5 w-3.5' />
      </Button>
    </div>
  )
}
