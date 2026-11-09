'use client'

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { Bot, CalendarDays, User, Users } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { BADGE_TINTS } from '@pts/ui/badge-tints'
import { formatHours } from '@pts/ui/numbers'

import {
  CardAssigneeAvatars,
  type CardAssignee,
} from '@/components/cards/card-assignee-avatars'
import { MetaLink } from '@/components/ui/meta-link'
import { CONCEPT_ICONS } from '@/lib/concept-icons'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { TaskContextMenu } from './task-context-menu'
import { BOARD_CARD_GHOST_CLASS } from '@/components/board/board-drag'
import { cn } from '@/lib/utils'
import type {
  ProjectTypeValue,
  TaskWithRelations,
  WorkerStatusValue,
} from '@/lib/types'
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'

type AssigneeInfo = CardAssignee

type TaskContextDetails = {
  clientLabel?: string
  /** The client's company, opened over the page; none for other work. */
  clientCompanyId?: string | null
  projectLabel?: string
  /** The project's board. */
  projectHref?: string | null
  layout?: 'inline' | 'stacked'
  projectType?: ProjectTypeValue
}

type TaskCardProps = {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  onEdit: (task: TaskWithRelations) => void
  draggable: boolean
  /** Shows Duplicate and Archive in the card's right-click menu. */
  canManage: boolean
  isActive?: boolean
  disableDropTransition?: boolean
  context?: TaskContextDetails
}

function CardContent({
  task,
  assignees,
  context,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  context?: TaskContextDetails
}) {
  const attachmentCount = task.attachmentCount ?? task.attachments?.length ?? 0
  const loggedHours = task.loggedHours ?? 0
  const dueMeta = task.due_on
    ? getTaskDueMeta(task.due_on, { status: task.status })
    : null
  const isCompleted = task.status === 'DONE'
  const lead = task.lead

  return (
    <>
      <h3
        className={cn(
          'text-foreground line-clamp-2 text-sm leading-snug font-semibold',
          isCompleted && 'line-through'
        )}
      >
        {task.title}
      </h3>
      {/* Meta stacks down the left; the assignee stack pins bottom-right so
          it never adds a row of its own. */}
      <div className='mt-4 flex items-end justify-between gap-3'>
        <div className='flex min-w-0 flex-1 flex-col gap-2'>
          {lead ? <CardLeadLink lead={lead} /> : null}
          {context?.clientLabel || context?.projectLabel ? (
            <div
              className={cn(
                'text-muted-foreground text-xs',
                context.layout === 'stacked'
                  ? 'flex min-w-0 flex-col items-start gap-2'
                  : 'flex min-w-0 flex-wrap items-center gap-3'
              )}
            >
              {/* Internal, personal and unbilled projects have no company to
                  open; the project name says enough. */}
              {context.clientLabel && context.clientCompanyId ? (
                <div className='flex max-w-full min-w-0 items-center gap-1'>
                  <MetaLink
                    sheet={{ entity: 'company', id: context.clientCompanyId }}
                    title={context.clientLabel}
                    onClick={event => event.stopPropagation()}
                    icon={renderProjectTypeIcon(
                      context?.projectType,
                      'h-3.5 w-3.5 shrink-0'
                    )}
                  >
                    {context.clientLabel}
                  </MetaLink>
                </div>
              ) : null}
              {context.projectLabel ? (
                context.projectHref ? (
                  <div className='flex max-w-full min-w-0 items-center gap-1'>
                    <MetaLink
                      href={context.projectHref}
                      title={context.projectLabel}
                      onClick={event => event.stopPropagation()}
                      icon={
                        <ENTITY_ICONS.project
                          className='h-3.5 w-3.5 shrink-0'
                          aria-hidden
                        />
                      }
                    >
                      {context.projectLabel}
                    </MetaLink>
                  </div>
                ) : (
                  <span
                    className='inline-flex max-w-full min-w-0 items-center gap-1'
                    title={context.projectLabel}
                  >
                    <ENTITY_ICONS.project
                      className='h-3.5 w-3.5 shrink-0'
                      aria-hidden
                    />
                    <span className='truncate'>{context.projectLabel}</span>
                  </span>
                )
              ) : null}
            </div>
          ) : null}
          {dueMeta ? (
            <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-xs'>
              <div
                className={cn(
                  'inline-flex items-center gap-1',
                  TASK_DUE_TONE_CLASSES[dueMeta.tone]
                )}
              >
                <CalendarDays className='h-3.5 w-3.5' />
                {dueMeta.label}
              </div>
            </div>
          ) : null}
          {task.commentCount > 0 || attachmentCount > 0 || loggedHours > 0 ? (
            <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-xs'>
              {task.commentCount > 0 ? (
                <span className='inline-flex items-center gap-1'>
                  <CONCEPT_ICONS.comment className='h-3.5 w-3.5' />
                  {task.commentCount}
                </span>
              ) : null}
              {attachmentCount > 0 ? (
                <span className='inline-flex items-center gap-1'>
                  <CONCEPT_ICONS.attachment className='h-3.5 w-3.5' />
                  {attachmentCount}
                </span>
              ) : null}
              {loggedHours > 0 ? (
                <span className='inline-flex items-center gap-1'>
                  <ENTITY_ICONS.timeLog className='h-3.5 w-3.5' aria-hidden />
                  {formatHours(loggedHours)}
                  <span className='sr-only'> logged</span>
                </span>
              ) : null}
            </div>
          ) : null}
          {task.worker_status ? (
            <WorkerBadge status={task.worker_status} />
          ) : null}
        </div>
        <CardAssigneeAvatars assignees={assignees} />
      </div>
    </>
  )
}

export function TaskCard({
  task,
  assignees,
  onEdit,
  draggable,
  canManage,
  isActive = false,
  disableDropTransition = false,
  context,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !draggable,
    data: {
      type: 'task',
      taskId: task.id,
      projectId: task.project_id,
      columnId: task.status,
    },
  })
  const listenersMap = listeners ?? {}
  const draggableKeyDown = (
    listenersMap as {
      onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
    }
  ).onKeyDown
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const cleanedAttributes = useMemo(() => {
    if (!attributes) {
      return {}
    }

    const { ['aria-describedby']: _omitDescribedBy, ...rest } = attributes
    void _omitDescribedBy
    return rest
  }, [attributes])

  const isCompleted = task.status === 'DONE'
  const shouldDisableTransition = disableDropTransition && !isDragging
  const style: CSSProperties = {
    opacity: isCompleted && !isDragging ? 0.65 : 1,
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: shouldDisableTransition
      ? 'none'
      : isDragging
        ? undefined
        : transition,
  }

  return (
    <TaskContextMenu
      task={task}
      onEdit={() => onEdit(task)}
      canManage={canManage}
      draggable={draggable}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...(isMounted ? attributes : cleanedAttributes)}
        {...listenersMap}
        // dnd-kit's attributes set this too; stated so the focus rule sees it.
        tabIndex={0}
        role='button'
        onClick={() => onEdit(task)}
        onKeyDown={event => {
          draggableKeyDown?.(event)
          if (event.defaultPrevented) {
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onEdit(task)
          }
        }}
        className={cn(
          'group bg-card rounded-lg border p-4 text-left shadow-sm transition',
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          // A touch drag starts on press-and-hold; keep iOS from selecting the
          // card's text or opening its callout menu first.
          draggable &&
            'pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]',
          isDragging && BOARD_CARD_GHOST_CLASS,
          isActive && !isDragging && 'border-primary/50 bg-primary/5 shadow-md',
          !isActive && !isDragging && !isCompleted && ENTITY_ACCENTS.task.card,
          !isActive &&
            !isDragging &&
            isCompleted &&
            'hover:border-muted-foreground/30 hover:bg-muted/20 hover:shadow-md'
        )}
      >
        <CardContent task={task} assignees={assignees} context={context} />
      </div>
    </TaskContextMenu>
  )
}

/**
 * The board card without the board: no dnd-kit (useSortable needs the board's
 * DndContext), no fixed width — a plain clickable card for surfaces like the
 * lead sheet's Tasks section that want board-identical rendering.
 */
export function TaskCardStatic({
  task,
  assignees,
  onClick,
  canManage,
  className,
  context,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  onClick: () => void
  canManage: boolean
  className?: string
  context?: TaskContextDetails
}) {
  const isCompleted = task.status === 'DONE'

  return (
    <TaskContextMenu
      task={task}
      onEdit={onClick}
      canManage={canManage}
      archivable={false}
    >
      <div
        role='button'
        tabIndex={0}
        onClick={onClick}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
          }
        }}
        className={cn(
          'group bg-card cursor-pointer rounded-lg border p-4 text-left shadow-sm transition',
          isCompleted
            ? 'hover:border-muted-foreground/30 hover:bg-muted/20 opacity-65 hover:shadow-md'
            : ENTITY_ACCENTS.task.card,
          className
        )}
      >
        <CardContent task={task} assignees={assignees} context={context} />
      </div>
    </TaskContextMenu>
  )
}

export function TaskCardPreview({
  task,
  assignees,
  context,
}: {
  task: TaskWithRelations
  assignees: AssigneeInfo[]
  context?: TaskContextDetails
}) {
  const isCompleted = task.status === 'DONE'
  return (
    <div
      className={cn(
        'bg-card w-full rounded-lg border p-4 shadow-sm',
        isCompleted ? 'opacity-65' : ENTITY_ACCENTS.task.cardStatic
      )}
    >
      <CardContent task={task} assignees={assignees} context={context} />
    </div>
  )
}

/** The linked lead; a click stacks its sheet over the board. */
function CardLeadLink({ lead }: { lead: { id: string; name: string } }) {
  return (
    <MetaLink
      sheet={{ entity: 'lead', id: lead.id }}
      className='text-muted-foreground self-start text-xs'
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
      icon={<ENTITY_ICONS.lead className='h-3.5 w-3.5 shrink-0' aria-hidden />}
    >
      {lead.name}
    </MetaLink>
  )
}

function renderProjectTypeIcon(
  projectType: ProjectTypeValue | undefined,
  className: string
) {
  if (projectType === 'INTERNAL') {
    return <Users className={className} aria-hidden />
  }

  if (projectType === 'PERSONAL') {
    return <User className={className} aria-hidden />
  }

  return <ENTITY_ICONS.company className={className} aria-hidden />
}

const WORKER_BADGE_CONFIG: Partial<
  Record<WorkerStatusValue, { label: string; className: string }>
> = {
  dispatched: { label: 'Dispatched', className: BADGE_TINTS.blue },
  working: { label: 'Executing', className: BADGE_TINTS.amber },
  implementing: { label: 'Executing', className: BADGE_TINTS.amber },
  plan_ready: { label: 'Plan ready', className: BADGE_TINTS.blue },
  pr_created: { label: 'PR created', className: BADGE_TINTS.emerald },
  error: { label: 'Error', className: BADGE_TINTS.rose },
  cancelled: { label: 'Cancelled', className: BADGE_TINTS.orange },
}

function WorkerBadge({ status }: { status: WorkerStatusValue }) {
  const config = WORKER_BADGE_CONFIG[status]
  if (!config) return null
  return (
    <Badge variant='outline' className={cn('w-fit', config.className)}>
      <Bot />
      {config.label}
    </Badge>
  )
}

export type { TaskContextDetails }
