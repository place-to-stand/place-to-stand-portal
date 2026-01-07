'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  Check,
  Loader2,
  X,
  HelpCircle,
  Calendar,
  FolderKanban,
  Building2,
  ChevronDown,
  Mail,
  ExternalLink,
  RotateCcw,
  Flag,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  getTaskStatusToken,
  getTaskStatusLabel,
} from '@/lib/projects/task-status'

export type TaskStatus =
  | 'BACKLOG'
  | 'ON_DECK'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'IN_REVIEW'
  | 'DONE'

export type SuggestionType = 'TASK' | 'PR' | 'REPLY'

export type SuggestionEmailContext = {
  threadId: string | null
  subject: string | null
  fromEmail: string
  sentAt: string | null
}

export type SuggestionCreatedTask = {
  id: string
}

export type SuggestionCardData = {
  id: string
  type: SuggestionType
  title: string
  description: string | null
  confidence: number
  reasoning: string | null
  priority: string | null
  dueDate: string | null
  // Client info (for display in suggestions page)
  client?: {
    id: string
    name: string
    slug?: string | null
  } | null
  project?: {
    id: string
    name: string
    slug?: string | null
    clientSlug?: string | null
  } | null
  // Optional email context (shown on suggestions page, not in project sheet)
  emailContext?: SuggestionEmailContext | null
  // Optional created task link (for approved suggestions)
  createdTask?: SuggestionCreatedTask | null
}

type SuggestionCardProps = {
  suggestion: SuggestionCardData
  isCreating?: boolean
  onCreateTask: (status: TaskStatus) => void
  onReject: (reason?: string) => void
  onUnreject?: () => void
  // Optional features
  showProjectLink?: boolean
  showCheckbox?: boolean
  selected?: boolean
  onSelect?: () => void
  disabled?: boolean
  showActions?: boolean
  showUnreject?: boolean
  // Status tracking for bulk operations
  onStatusChange?: (status: TaskStatus) => void
  initialStatus?: TaskStatus
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'ON_DECK', label: 'On Deck' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
]

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8)
    return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
  if (confidence >= 0.6)
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
}

function getPriorityStyle(priority: string): string {
  switch (priority.toUpperCase()) {
    case 'HIGH':
    case 'URGENT':
      return 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400'
    case 'MEDIUM':
      return 'border-amber-300 text-amber-600 dark:border-amber-800 dark:text-amber-400'
    default:
      return 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
  }
}

export function SuggestionCard({
  suggestion,
  isCreating = false,
  onCreateTask,
  onReject,
  onUnreject,
  showProjectLink = false,
  showCheckbox = false,
  selected = false,
  onSelect,
  disabled = false,
  showActions = true,
  showUnreject = false,
  onStatusChange,
  initialStatus = 'BACKLOG',
}: SuggestionCardProps) {
  const [selectedStatus, setSelectedStatus] =
    useState<TaskStatus>(initialStatus)

  const handleStatusChange = (status: TaskStatus) => {
    setSelectedStatus(status)
    onStatusChange?.(status)
  }

  const confidencePercent = Math.round(suggestion.confidence * 100)

  const clientUrl = suggestion.client?.slug
    ? `/clients/${suggestion.client.slug}`
    : null

  const projectUrl =
    suggestion.project?.slug && suggestion.project?.clientSlug
      ? `/projects/${suggestion.project.clientSlug}/${suggestion.project.slug}/board`
      : null

  return (
    <div
      className={cn(
        'bg-muted/30 rounded-lg border p-4 transition-all',
        selected && 'ring-primary ring-2'
      )}
    >
      <div className='flex items-start gap-3'>
        {showCheckbox && onSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            className='mt-0.5'
          />
        )}

        <div className='min-w-0 flex-1'>
          {/* Header: Type badge + Title + Priority + Confidence + Reasoning */}
          <div className='flex items-start justify-between gap-2'>
            <div className='flex min-w-0 flex-1 items-center gap-2'>
              <Badge variant='outline' className='shrink-0 text-xs'>
                {suggestion.type}
              </Badge>
              <h4 className='truncate text-sm font-medium'>
                {suggestion.title}
              </h4>
            </div>

            {/* Right side: Priority + Confidence + Reasoning tooltip */}
            <div className='flex shrink-0 items-center gap-1.5'>
              <Badge
                variant='secondary'
                className={cn(
                  'text-xs',
                  getConfidenceColor(suggestion.confidence)
                )}
              >
                {confidencePercent}%
              </Badge>
              {suggestion.reasoning && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type='button'
                        className='text-muted-foreground hover:text-foreground'
                      >
                        <HelpCircle className='h-4 w-4' />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side='left' className='max-w-xs'>
                      <p className='text-xs'>{suggestion.reasoning}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Description */}
          {suggestion.description && (
            <p className='text-muted-foreground mt-4 text-sm'>
              {suggestion.description}
            </p>
          )}

          {/* Metadata badges */}
          <div className='mt-4 flex flex-wrap items-center gap-2'>
            {suggestion.priority && (
              <Badge
                variant='outline'
                className={cn(
                  'text-xs uppercase',
                  getPriorityStyle(suggestion.priority)
                )}
              >
                <Flag className='mr-1 h-3 w-3' />
                {suggestion.priority}
              </Badge>
            )}
            {/* Client badge (blue) - displayed first */}
            {showProjectLink &&
              suggestion.client &&
              (clientUrl ? (
                <Link href={clientUrl}>
                  <Badge
                    variant='default'
                    className='cursor-pointer border-0 bg-blue-100 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70'
                  >
                    <Building2 className='mr-1 h-3 w-3' />
                    {suggestion.client.name}
                  </Badge>
                </Link>
              ) : (
                <Badge
                  variant='default'
                  className='border-0 bg-blue-100 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300'
                >
                  <Building2 className='mr-1 h-3 w-3' />
                  {suggestion.client.name}
                </Badge>
              ))}
            {/* Project badge (green) */}
            {showProjectLink &&
              suggestion.project &&
              (projectUrl ? (
                <Link href={projectUrl}>
                  <Badge
                    variant='default'
                    className='cursor-pointer border-0 bg-green-100 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900/70'
                  >
                    <FolderKanban className='mr-1 h-3 w-3' />
                    {suggestion.project.name}
                  </Badge>
                </Link>
              ) : (
                <Badge
                  variant='default'
                  className='border-0 bg-green-100 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/50 dark:text-green-300'
                >
                  <FolderKanban className='mr-1 h-3 w-3' />
                  {suggestion.project.name}
                </Badge>
              ))}
            {suggestion.dueDate && (
              <Badge variant='outline' className='text-xs'>
                <Calendar className='mr-1 h-3 w-3' />
                {suggestion.dueDate}
              </Badge>
            )}
            {/* Email context (for suggestions page) */}
            {suggestion.emailContext && (
              <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
                {suggestion.emailContext.threadId ? (
                  <Link
                    href={`/my/inbox?thread=${suggestion.emailContext.threadId}`}
                    className='hover:text-foreground flex items-center gap-1 hover:underline'
                  >
                    <Mail className='h-3 w-3' />
                    {suggestion.emailContext.subject || '(no subject)'}
                  </Link>
                ) : (
                  <span className='flex items-center gap-1'>
                    <Mail className='h-3 w-3' />
                    {suggestion.emailContext.subject || '(no subject)'}
                  </span>
                )}
                {suggestion.emailContext.sentAt && (
                  <>
                    <span className='text-muted-foreground/50'>·</span>
                    <span>
                      {formatDistanceToNow(
                        new Date(suggestion.emailContext.sentAt)
                      )}{' '}
                      ago
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {showActions && (
            <div className='mt-3 flex items-center gap-2 border-t pt-3'>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={isCreating || disabled}
                    className='gap-1.5'
                  >
                    <Badge
                      variant='secondary'
                      className={cn(
                        'h-5 px-1.5 text-xs',
                        getTaskStatusToken(selectedStatus)
                      )}
                    >
                      {getTaskStatusLabel(selectedStatus)}
                    </Badge>
                    <ChevronDown className='h-3 w-3' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start'>
                  {STATUS_OPTIONS.map(option => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                    >
                      <Badge
                        variant='secondary'
                        className={cn(
                          'mr-2 h-5 px-1.5 text-xs',
                          getTaskStatusToken(option.value)
                        )}
                      >
                        {option.label}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size='sm'
                onClick={() => onCreateTask(selectedStatus)}
                disabled={isCreating || disabled}
              >
                {isCreating ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className='h-4 w-4' />
                    {suggestion.type === 'TASK' ? 'Create Task' : 'Create PR'}
                  </>
                )}
              </Button>

              <Button
                variant='ghost'
                size='sm'
                onClick={() => onReject()}
                disabled={isCreating || disabled}
                className='text-muted-foreground hover:text-destructive ml-auto'
              >
                <X className='h-4 w-4' />
                Reject
              </Button>
            </div>
          )}

          {/* Unreject action for rejected suggestions */}
          {showUnreject && onUnreject && (
            <div className='mt-3 flex items-center gap-2 border-t pt-3'>
              <Button
                size='sm'
                variant='outline'
                onClick={onUnreject}
                disabled={isCreating || disabled}
              >
                {isCreating ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className='h-4 w-4' />
                    Restore to Pending
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Created task link (for approved suggestions on suggestions page) */}
          {suggestion.createdTask && projectUrl && (
            <div className='mt-3 border-t pt-3'>
              <Link
                href={`${projectUrl}/${suggestion.createdTask.id}`}
                className='text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline'
              >
                <ExternalLink className='h-3.5 w-3.5' />
                View created task
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
