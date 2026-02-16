'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  GitPullRequestArrow,
  Loader2,
  Play,
  StopCircle,
  Terminal,
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
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { DbTaskDeployment } from '@/lib/types'
import type {
  WorkerComment,
  WorkerCommentStatus,
} from '../../actions/fetch-worker-status'
import { useWorkerStatus, type WorkerStatusData } from './use-worker-status'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkerModel = 'opus' | 'sonnet' | 'haiku'

type DeploymentCardProps = {
  deployment: DbTaskDeployment
  /** Worker status data — only provided for the active (polled) deployment */
  workerStatusData: WorkerStatusData | null
  isActive: boolean
  onAcceptPlan: (deploymentId: string, model: WorkerModel) => void
  isAccepting: boolean
  onCancel: (deploymentId: string) => void
  isCancelling: boolean
  /** 1-based index shown as a numbered badge (oldest = 1) */
  index?: number
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function WorkerStatusBadge({ status }: { status: WorkerCommentStatus | string }) {
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

// ---------------------------------------------------------------------------
// PR link with hover-revealed copy buttons
// ---------------------------------------------------------------------------

function CopyButton({
  text,
  label,
  icon: Icon,
  title,
  className = '',
}: {
  text: string
  label: string
  icon: typeof Copy
  title: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!copied || !btnRef.current) { setPos(null); return }
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.top - 4, left: rect.left + rect.width / 2 })
  }, [copied])

  return (
    <span className={className}>
      <button
        ref={btnRef}
        type='button'
        onClick={e => {
          e.stopPropagation()
          navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
        className='cursor-pointer text-muted-foreground hover:text-foreground'
        title={title}
      >
        {copied
          ? <Check className='h-3.5 w-3.5 text-green-600 dark:text-green-400' />
          : <Icon className='h-3.5 w-3.5' />}
      </button>
      {copied && pos && createPortal(
        <span
          className='pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full animate-in fade-in slide-in-from-bottom-1 duration-150'
          style={{ top: pos.top, left: pos.left }}
        >
          <span className='flex max-w-[260px] flex-col whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 text-[11px] shadow-md ring-1 ring-border'>
            <span className='font-medium text-green-600 dark:text-green-400'>
              {label} copied
            </span>
            <span className='truncate text-muted-foreground'>{text}</span>
          </span>
        </span>,
        document.body,
      )}
    </span>
  )
}

function PrLinkWithCopy({ prUrl }: { prUrl: string }) {
  return (
    <span className='inline-flex items-center gap-1.5' onClick={e => e.stopPropagation()}>
      <a
        href={prUrl}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:underline dark:text-green-400'
      >
        <GitPullRequestArrow className='h-3.5 w-3.5' />
        PR
      </a>
      <CopyButton
        text={prUrl}
        label='PR link'
        icon={Copy}
        title='Copy PR link'
        className='hidden group-hover/deploy-row:inline-flex'
      />
      <CopyButton
        text={`git pull ${prUrl}`}
        label='git pull'
        icon={Terminal}
        title='Copy git pull command'
        className='hidden group-hover/deploy-row:inline-flex'
      />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Comment card (reused from old deployment-panel)
// ---------------------------------------------------------------------------

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
    <div>
      <div
        className={`sticky top-0 z-[5] flex items-center justify-between bg-background/60 px-3 py-2 transition-colors ${isMultiLine ? 'cursor-pointer hover:bg-background/80' : ''}`}
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

      {expanded && (
        <div className='bg-background/30 px-3 py-3'>
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

// ---------------------------------------------------------------------------
// Deployment row (rendered inside a shared list container)
// ---------------------------------------------------------------------------

export function DeploymentCard({
  deployment,
  workerStatusData,
  isActive,
  onAcceptPlan,
  isAccepting,
  onCancel,
  isCancelling,
  index,
}: DeploymentCardProps) {
  const [expanded, setExpanded] = useState(isActive)
  const [model, setModel] = useState<WorkerModel>('sonnet')

  const timeAgo = formatDistanceToNow(new Date(deployment.created_at), {
    addSuffix: true,
  })

  // Fetch worker status independently when the parent isn't supplying it
  // and the card is expanded. For terminal deployments this fetches once
  // then stops polling. Collapsed cards make no GitHub API calls.
  const ownWorkerStatus = useWorkerStatus(
    !workerStatusData && expanded ? deployment.id : null
  )

  // Use parent-supplied data when available, otherwise our own fetch
  const effectiveStatus = workerStatusData ?? ownWorkerStatus

  const liveStatus = effectiveStatus.latestStatus
  const displayStatus = liveStatus ?? deployment.worker_status
  const prUrl = effectiveStatus.prUrl ?? deployment.pr_url ?? null
  const comments = effectiveStatus.allComments ?? []
  const isWorking = effectiveStatus.isWorking ?? false
  const isLoading = effectiveStatus.isStatusLoading ?? false

  const modeLabel = deployment.mode === 'execute' ? 'Execute' : 'Plan'
  const modelLabel = deployment.model ?? 'sonnet'

  return (
    <div className={isActive ? 'bg-background/40' : undefined}>
      {/* Row header — always visible */}
      <div
        className='group/deploy-row flex cursor-pointer items-center justify-between bg-background/60 px-3 py-2 transition-colors hover:bg-background/80'
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          {index !== undefined && (
            <span className='shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground'>
              #{index}
            </span>
          )}
          <WorkerStatusBadge status={displayStatus} />
          <a
            href={deployment.github_issue_url}
            target='_blank'
            rel='noopener noreferrer'
            className='shrink-0 text-xs text-muted-foreground hover:text-foreground'
            onClick={e => e.stopPropagation()}
          >
            #{deployment.github_issue_number}
            <ExternalLink className='ml-0.5 inline h-3 w-3' />
          </a>
          {prUrl && (
            <PrLinkWithCopy prUrl={prUrl} />
          )}
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          {(displayStatus === 'working' || displayStatus === 'implementing') && (
            <button
              type='button'
              onClick={e => {
                e.stopPropagation()
                onCancel(deployment.id)
              }}
              disabled={isCancelling}
              className='inline-flex items-center text-destructive hover:text-destructive/80 disabled:opacity-50'
              title='Cancel deployment'
            >
              {isCancelling ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <StopCircle className='h-4 w-4' />
              )}
            </button>
          )}
          <span className='text-[10px] text-muted-foreground'>{timeAgo}</span>
          {expanded
            ? <ChevronUp className='h-3 w-3 text-muted-foreground' />
            : <ChevronDown className='h-3 w-3 text-muted-foreground' />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className='flex flex-col gap-3 border-t border-dashed px-3 py-3'>
          {/* Working spinner */}
          {isWorking && (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              {displayStatus === 'working' ? 'Worker is planning...' : 'Worker is executing...'}
            </div>
          )}

          {/* Accept Plan controls */}
          {displayStatus === 'plan_ready' && (
            <div className='flex items-center gap-2'>
              <Select value={model} onValueChange={v => setModel(v as WorkerModel)}>
                <SelectTrigger className='h-8 w-[110px] text-xs'>
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
                onClick={e => {
                  e.stopPropagation()
                  onAcceptPlan(deployment.id, model)
                }}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                ) : (
                  <Play className='mr-1.5 h-3.5 w-3.5' />
                )}
                Accept Plan
              </Button>
            </div>
          )}

          {/* Error state */}
          {displayStatus === 'error' && (
            <div className='flex items-center gap-1.5 text-xs text-destructive'>
              <AlertTriangle className='h-3.5 w-3.5' />
              Worker encountered an error.
            </div>
          )}

          {displayStatus === 'done_no_changes' && !prUrl && (
            <p className='text-xs text-muted-foreground'>
              Worker completed with no changes.
            </p>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              Loading comments...
            </div>
          )}

          {/* Comment feed */}
          {comments.length > 0 && (
            <div>
              <h4 className='mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                <span>Worker Responses ({comments.length})</span>
                <span className='text-[10px]'>{modeLabel} &middot; {modelLabel}</span>
              </h4>
              <div className='overflow-hidden rounded-lg border'>
                {comments.map((comment, i) => (
                  <div key={comment.id} className={i > 0 ? 'border-t' : undefined}>
                    <CommentCard
                      comment={comment}
                      defaultExpanded={i === comments.length - 1}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
