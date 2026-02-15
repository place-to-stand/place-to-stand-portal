'use client'

import { useCallback, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitPullRequestArrow,
  Info,
  Loader2,
  Play,
  RefreshCw,
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
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { triggerWorkerPlan, triggerWorkerImplement } from '../../actions/trigger-worker'
import {
  type WorkerComment,
  type WorkerCommentStatus,
  type WorkerStatusResult,
} from '../../actions/fetch-worker-status'

import type { GitHubRepoLinkSummary, TaskWithRelations } from '@/lib/types'
import type { WorkerStatusData } from './use-worker-status'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkerModel = 'opus' | 'sonnet' | 'haiku'
type DeployMode = 'plan' | 'execute'

type LocalIssueData = {
  issueNumber: number
  issueUrl: string
  workerStatus: 'working' | 'implementing'
}

type DeploymentPanelProps = {
  task: TaskWithRelations
  githubRepos: GitHubRepoLinkSummary[]
  workerStatus: WorkerStatusData
  localIssueData: LocalIssueData | null
  onDeploySuccess: (data: LocalIssueData) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeploymentPanel({ task, githubRepos, workerStatus, localIssueData, onDeploySuccess, onClose }: DeploymentPanelProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedRepoId, setSelectedRepoId] = useState<string>(
    githubRepos[0]?.id ?? ''
  )
  const [model, setModel] = useState<WorkerModel>('sonnet')
  const [deployMode, setDeployMode] = useState<DeployMode>('plan')
  const [isPlanPending, startPlanTransition] = useTransition()
  const [isImplPending, startImplTransition] = useTransition()

  const hasIssue = Boolean(task.github_issue_number) || Boolean(localIssueData)
  const issueNumber = task.github_issue_number ?? localIssueData?.issueNumber
  const issueUrl = task.github_issue_url ?? localIssueData?.issueUrl
  const localWorkerStatus = localIssueData?.workerStatus ?? null
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

      onDeploySuccess({
        issueNumber: result.issueNumber,
        issueUrl: result.issueUrl,
        workerStatus: result.workerStatus,
      })

      // Optimistically set status so polling resumes immediately
      const optimisticStatus: WorkerCommentStatus = deployMode === 'execute' ? 'implementing' : 'working'
      queryClient.setQueryData<WorkerStatusResult>(queryKey, {
        comments: [],
        prUrl: null,
        latestStatus: optimisticStatus,
      })

      const desc =
        deployMode === 'execute'
          ? 'GitHub issue created. Worker is executing...'
          : 'GitHub issue created. Worker is planning...'
      toast({ title: 'Deploy started', description: desc })
      queryClient.invalidateQueries({ queryKey })
    })
  }, [task.id, selectedRepoId, model, deployMode, toast, queryClient, queryKey, onDeploySuccess])

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

      // Optimistically set status so polling resumes (plan_ready is terminal)
      queryClient.setQueryData<WorkerStatusResult>(queryKey, prev => {
        if (!prev || 'error' in prev) {
          return { comments: [], prUrl: null, latestStatus: 'implementing' as const }
        }
        return { ...prev, latestStatus: 'implementing' as const }
      })

      toast({ title: 'Implementation requested', description: 'Worker is executing...' })
      queryClient.invalidateQueries({ queryKey })
    })
  }, [task.id, selectedRepoId, model, toast, queryClient, queryKey])

  const handleRetry = useCallback(() => {
    handleDeploy()
  }, [handleDeploy])

  return (
    <div className='flex h-full w-[560px] shrink-0 flex-col border-l'>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <div className='flex items-center gap-2'>
          <Bot className='h-4 w-4' />
          <span className='text-sm font-semibold'>Deployment</span>
          {(latestStatus ?? localWorkerStatus) && <WorkerStatusBadge status={(latestStatus ?? localWorkerStatus)!} />}
        </div>
        <Button variant='ghost' size='icon' className='h-7 w-7' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className='flex-1 overflow-y-auto px-4'>
        {/* No issue yet — show start plan controls */}
        {!hasIssue && (
          <div className='flex flex-col gap-4 py-2'>
            {/* Repo */}
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
        )}

        {/* Issue exists — show status + comment feed */}
        {hasIssue && (
          <div className='flex flex-col gap-4'>
            {/* Sticky bar: issue link + action buttons */}
            <div className='sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-background px-4 py-2'>
              {issueUrl && (
                <a
                  href={issueUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
                >
                  Issue #{issueNumber}
                  <ExternalLink className='h-3 w-3' />
                </a>
              )}

              {/* Working spinner */}
              {(isWorking || (!latestStatus && localWorkerStatus)) && (
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  {(latestStatus ?? localWorkerStatus) === 'working'
                    ? 'Worker is planning...'
                    : 'Worker is executing...'}
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

              {/* PR link */}
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

            </div>

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

            {/* Comment feed — bot responses only */}
            {allComments.length > 0 && (
              <div className='flex flex-col gap-3 pb-4'>
                <h4 className='text-xs font-medium text-muted-foreground'>
                  Worker Responses ({allComments.length})
                </h4>
                {allComments.map((comment, i) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    defaultExpanded={i === allComments.length - 1}
                  />
                ))}
              </div>
            )}
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

function getFirstLine(body: string): string {
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (trimmed) return trimmed
  }
  return body.trim()
}

function CommentCard({
  comment,
  defaultExpanded,
}: {
  comment: WorkerComment
  defaultExpanded: boolean
}) {
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
  })

  const [expanded, setExpanded] = useState(defaultExpanded)
  const firstLine = getFirstLine(comment.body)
  const isMultiLine = comment.body.trim() !== firstLine

  return (
    <div className='overflow-hidden rounded-lg border'>
      {/* Clickable header — always visible, includes collapsed preview */}
      <div
        className={`sticky top-0 z-[5] flex items-center justify-between bg-muted/20 px-3 py-3 ${isMultiLine ? 'cursor-pointer' : ''}`}
        onClick={isMultiLine ? () => setExpanded(prev => !prev) : undefined}
      >
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comment.avatarUrl}
            alt={comment.login}
            className='h-5 w-5 shrink-0 rounded-full'
          />
          <span className='shrink-0 text-xs font-medium'>pts-worker</span>
          {comment.status !== 'unknown' && (
            <WorkerStatusBadge status={comment.status} />
          )}
          {!expanded && (
            <span className='min-w-0 flex-1 truncate text-xs text-muted-foreground'>
              {firstLine}
            </span>
          )}
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          <a
            href={comment.htmlUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-[10px] text-muted-foreground hover:text-foreground'
            onClick={e => e.stopPropagation()}
          >
            {timeAgo}
          </a>
          {isMultiLine && (
            expanded
              ? <ChevronUp className='h-3 w-3 text-muted-foreground' />
              : <ChevronDown className='h-3 w-3 text-muted-foreground' />
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className='bg-muted/40 px-3 py-3'>
          <div className='prose prose-sm dark:prose-invert max-w-none'>
            <Markdown remarkPlugins={[remarkGfm]}>{comment.body}</Markdown>
          </div>

          {isMultiLine && (
            <button
              type='button'
              onClick={() => setExpanded(false)}
              className='mt-1 flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground'
            >
              <ChevronUp className='h-3 w-3' />
              Collapse
            </button>
          )}
        </div>
      )}
    </div>
  )
}
