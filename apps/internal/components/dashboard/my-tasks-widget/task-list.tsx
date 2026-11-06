import { CalendarDays, ChevronRight, User, Users } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { LoadMoreButton } from '@/components/ui/load-more-button'
import { MY_TASKS_WIDGET_PAGE_SIZE } from '@/lib/dashboard/types'
import type { AssignedTaskSummary } from '@/lib/data/tasks'
import type { ProjectTypeValue } from '@/lib/types'
import {
  TASK_DUE_TONE_CLASSES,
  getTaskDueMeta,
} from '@/lib/projects/task-due-date'
import {
  getTaskStatusLabel,
  getTaskStatusToken,
} from '@/lib/projects/task-status'
import { cn } from '@/lib/utils'
import { MetaLink } from '@/components/ui/meta-link'
import { SheetLink } from '@/components/ui/sheet-link'
import { ENTITY_ICONS } from '@/lib/entity-accents'

type TaskListProps = {
  items: AssignedTaskSummary[]
  totalCount: number
  isLoadingMore: boolean
  onLoadMore: () => void
  error: string | null
}

export function TaskList({
  items,
  totalCount,
  isLoadingMore,
  onLoadMore,
  error,
}: TaskListProps) {
  const remaining = Math.max(0, totalCount - items.length)

  return (
    <div className='flex h-full flex-col'>
      <ul className='divide-border flex flex-col divide-y'>
        {items.map(task => (
          <TaskListItem key={task.id} task={task} />
        ))}
      </ul>
      {/*
        Same ghost "Load N more" as the hours widget's log list, sitting under
        a rule so it reads as the list's footer rather than one more row.
      */}
      {error || remaining > 0 ? (
        <div className='border-t px-2 py-1.5'>
          {error ? (
            <p className='text-destructive px-2 pb-1 text-xs'>{error}</p>
          ) : null}
          {remaining > 0 ? (
            <LoadMoreButton
              onClick={onLoadMore}
              loading={isLoadingMore}
              label={`Load ${Math.min(MY_TASKS_WIDGET_PAGE_SIZE, remaining)} more`}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function TaskListItem({ task }: { task: AssignedTaskSummary }) {
  const dueMeta = getTaskDueMeta(task.dueOn, { status: task.status })
  const clientCompanyId = getClientCompanyId(task)
  const statusToken = getTaskStatusToken(task.status)
  const statusLabel = getTaskStatusLabel(task.status)
  const clientLabel = getClientDisplayName(task)

  return (
    <li className='group relative'>
      {/* The row opens the task's sheet over the page. */}
      <SheetLink
        sheet={{ entity: 'task', id: task.id }}
        // Full-bleed so the highlight meets the row dividers and the card's own
        // clipped corners; a per-row radius left square gaps at every edge.
        className='hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-0 z-0 transition outline-none focus-visible:ring-[3px] focus-visible:ring-inset'
        aria-label={`View task: ${task.title}`}
      />
      <article className='pointer-events-none relative z-10 flex items-start gap-2 px-4 py-2.5'>
        <div className='min-w-0 flex-1 space-y-1'>
          <span className='text-foreground group-hover:text-primary block truncate text-sm font-semibold underline-offset-4 transition'>
            {task.title}
          </span>
          <div className='flex min-w-0 items-center gap-1.5'>
            <Badge variant='outline' className={cn(statusToken)}>
              {statusLabel}
            </Badge>
            {/*
              Meta line matches the time-log rows: 11px text, size-3 icons, and
              a dot between each fragment so they read as one breadcrumb rather
              than three floating chips.
            */}
            <div className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs'>
              {task.lead ? (
                <>
                  <MetaLink
                    sheet={{ entity: 'lead', id: task.lead.id }}
                    onClick={e => e.stopPropagation()}
                    className='pointer-events-auto relative z-20'
                    icon={
                      <ENTITY_ICONS.lead
                        className='size-3 shrink-0'
                        aria-hidden
                      />
                    }
                  >
                    {task.lead.name}
                  </MetaLink>
                  {task.project ? <MetaSeparator /> : null}
                </>
              ) : null}
              {/* No company to open for internal or personal work. */}
              {clientCompanyId ? (
                <>
                  <MetaLink
                    sheet={{ entity: 'company', id: clientCompanyId }}
                    onClick={e => e.stopPropagation()}
                    className='pointer-events-auto relative z-20'
                    icon={
                      task.project
                        ? renderProjectTypeIcon(
                            task.project.type,
                            'size-3 shrink-0'
                          )
                        : null
                    }
                  >
                    {clientLabel}
                  </MetaLink>
                  <MetaSeparator />
                </>
              ) : null}
              {/* A lead task has no project: its lead line says where it is. */}
              {!task.project ? null : (
                <MetaLink
                  sheet={{ entity: 'project', id: task.project.id }}
                  onClick={e => e.stopPropagation()}
                  className='pointer-events-auto relative z-20'
                  icon={
                    <ENTITY_ICONS.project
                      className='size-3 shrink-0'
                      aria-hidden
                    />
                  }
                >
                  {task.project.name}
                </MetaLink>
              )}
              {/* No due date set is the common case -- say nothing rather than
                  spend a line saying there's nothing to say. */}
              {task.dueOn ? (
                <>
                  <MetaSeparator />
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1',
                      TASK_DUE_TONE_CLASSES[dueMeta.tone]
                    )}
                  >
                    <CalendarDays className='size-3 shrink-0' aria-hidden />
                    {dueMeta.label}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <ChevronRight
          className='text-muted-foreground size-4 shrink-0 self-center'
          aria-hidden
        />
      </article>
    </li>
  )
}

function MetaSeparator() {
  return (
    <span aria-hidden className='shrink-0 opacity-50'>
      ·
    </span>
  )
}

/** The company to open for a client project's task; none for other work. */
function getClientCompanyId(task: AssignedTaskSummary): string | null {
  const { client, project } = task
  // A client is its company.
  return project?.type === 'CLIENT' && client ? client.id : null
}

function getClientDisplayName(task: AssignedTaskSummary): string {
  if (task.client?.name) {
    return task.client.name
  }

  if (task.project?.type === 'PERSONAL') {
    return 'Personal'
  }

  if (task.project?.type === 'INTERNAL') {
    return 'Internal'
  }

  return 'Unassigned'
}

function renderProjectTypeIcon(
  projectType: ProjectTypeValue,
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
