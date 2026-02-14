'use client'

import { useCallback, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Bot,
  ExternalLink,
  GitPullRequestArrow,
  Loader2,
  Play,
  RefreshCw,
  Send,
  AlertTriangle,
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

import { triggerWorkerPlan, triggerWorkerImplement } from '../../actions/trigger-worker'
import {
  type WorkerComment,
  type WorkerCommentStatus,
} from '../../actions/fetch-worker-status'

import type { GitHubRepoLinkSummary, TaskWithRelations } from '@/lib/types'
import type { WorkerStatusData } from './use-worker-status'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkerModel = 'opus' | 'sonnet' | 'haiku'

type DeploymentPanelProps = {
  task: TaskWithRelations
  githubRepos: GitHubRepoLinkSummary[]
  workerStatus: WorkerStatusData
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeploymentPanel({ task, githubRepos, workerStatus, onClose }: DeploymentPanelProps) {
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
  const {
    statusData,
    isStatusLoading,
    latestStatus,
    prUrl,
    allComments,
    isWorking,
    queryKey,
  } = workerStatus

  const isPending = isPlanPending || isImplPending
  const selectedRepo = githubRepos.find(r => r.id === selectedRepoId)

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

  // Determine if we should show the custom prompt input
  const showCustomPrompt =
    hasIssue &&
    latestStatus !== 'working' &&
    latestStatus !== 'implementing'

  return (
    <div className='flex h-full w-[calc(676px*0.6)] shrink-0 flex-col border-l'>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <div className='flex items-center gap-2'>
          <Bot className='h-4 w-4' />
          <span className='text-sm font-semibold'>Deployment</span>
          {latestStatus && <WorkerStatusBadge status={latestStatus} />}
        </div>
        <Button variant='ghost' size='icon' className='h-7 w-7' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className='flex-1 overflow-y-auto px-4 py-4'>
        {/* No issue yet — show start plan controls */}
        {!hasIssue && (
          <div className='flex flex-col gap-3'>
            <p className='text-xs text-muted-foreground'>
              Create a GitHub issue and start the worker agent.
            </p>
            <div className='flex flex-col gap-2'>
              {githubRepos.length > 1 && (
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

        {/* Issue exists — show status + comment feed */}
        {hasIssue && (
          <div className='flex flex-col gap-4'>
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

            {/* Working spinner */}
            {isWorking && (
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                {latestStatus === 'working'
                  ? 'Worker is planning...'
                  : 'Worker is implementing...'}
              </div>
            )}

            {/* Action buttons */}
            {latestStatus === 'plan_ready' && (
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
            )}

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

            {latestStatus === 'done_no_changes' && !prUrl && (
              <p className='text-xs text-muted-foreground'>
                Worker completed with no changes.
              </p>
            )}

            {latestStatus === 'error' && (
              <div className='flex items-center gap-2'>
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

            {/* Loading state */}
            {isStatusLoading && (
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                Loading comments...
              </div>
            )}

            {/* Status error from fetch */}
            {statusData && 'error' in statusData && (
              <p className='text-xs text-destructive'>{statusData.error}</p>
            )}

            {/* Comment feed */}
            {allComments.length > 0 && (
              <div className='flex flex-col gap-3'>
                <h4 className='text-xs font-medium text-muted-foreground'>
                  Comments ({allComments.length})
                </h4>
                {allComments.map(comment => (
                  <CommentCard key={comment.id} comment={comment} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — custom prompt input */}
      {showCustomPrompt && (
        <div className='border-t px-4 py-3'>
          <div className='flex gap-2'>
            <Textarea
              placeholder='Custom prompt for worker...'
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              className='min-h-[60px] text-xs'
              disabled={isPending}
            />
            <Button
              size='sm'
              variant='outline'
              onClick={handleSendCustom}
              disabled={isPending || !customPrompt.trim()}
              className='self-end'
            >
              <Send className='h-3.5 w-3.5' />
            </Button>
          </div>
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

function CommentCard({ comment }: { comment: WorkerComment }) {
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
  })

  return (
    <div className='rounded-lg border bg-background p-3'>
      <div className='mb-2 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comment.avatarUrl}
            alt={comment.login}
            className='h-5 w-5 rounded-full'
          />
          <span className='text-xs font-medium'>
            {comment.isBot ? 'pts-worker' : comment.login}
          </span>
          {comment.isBot && comment.status !== 'unknown' && (
            <WorkerStatusBadge status={comment.status} />
          )}
        </div>
        <a
          href={comment.htmlUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='text-[10px] text-muted-foreground hover:text-foreground'
        >
          {timeAgo}
        </a>
      </div>
      <div className='prose prose-sm dark:prose-invert max-w-none'>
        <pre className='whitespace-pre-wrap text-xs'>{comment.body}</pre>
      </div>
    </div>
  )
}
