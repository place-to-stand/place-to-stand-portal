'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
} from 'react'
import {
  ListTodo,
  Plus,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Circle,
  RotateCcw,
} from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@pts/ui/skeleton'
import type { LeadRecord } from '@/lib/leads/types'
import { formatCalendarDate } from '@/lib/dates'
import { NEW_SHEET_VALUE } from '@/lib/sheets/entities'
import { myTaskHref } from '@/lib/sheets/hrefs'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { prefetchSheetInit } from '@/lib/sheets/wrappers/use-sheet-init'

import { restoreTask } from '@/app/(dashboard)/projects/actions/restore-task'

type LeadTask = {
  id: string
  title: string
  status: string
  dueOn: string | null
  createdAt: string
  /** Non-null = archived. Lead tasks have no project archive to live in (D18). */
  deletedAt: string | null
}

type LeadTasksSectionProps = {
  lead: LeadRecord
  canManage: boolean
  onSuccess?: () => void
}

export function LeadTasksSection({
  lead,
  canManage,
  onSuccess,
}: LeadTasksSectionProps) {
  const { openNew, get } = useSheetParams()
  const [tasks, setTasks] = useState<LeadTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [isRestoring, startRestore] = useTransition()
  const taskParam = get('task')

  const fetchTasks = useCallback(() => {
    // Promise-chained (not awaited inline) so every setState runs
    // asynchronously, even if fetch itself throws synchronously.
    return fetch(`/api/leads/${lead.id}/tasks`)
      .then(async response => {
        if (response.ok) {
          const data = await response.json()
          setTasks(data.tasks ?? [])
        }
      })
      .catch(error => {
        console.error('Failed to fetch lead tasks:', error)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [lead.id])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Warm the task sheet's reference data while the user reads the lead, so
  // "Create" opens immediately instead of after a round-trip.
  useEffect(() => {
    if (canManage) {
      prefetchSheetInit('task', NEW_SHEET_VALUE)
    }
  }, [canManage])

  // The task sheet stacks on top of this one via `?task=` (rendered by the
  // global SheetHost). Refetch the linked tasks once that param clears, so a
  // task created here shows up in the list. This runs in an effect, not the
  // adjust-during-render pattern: `onSuccess` sets state in the parent, and
  // updating another component during render is illegal.
  const previousTaskParamRef = useRef(taskParam)
  useEffect(() => {
    const previous = previousTaskParamRef.current
    previousTaskParamRef.current = taskParam

    if (previous !== null && taskParam === null) {
      void fetchTasks()
      onSuccess?.()
    }
  }, [fetchTasks, onSuccess, taskParam])

  const handleRestore = useCallback(
    (taskId: string) => {
      startRestore(async () => {
        const result = await restoreTask({ taskId })

        if (result.error) {
          setRestoreError(result.error)
          return
        }

        setRestoreError(null)
        await fetchTasks()
        onSuccess?.()
      })
    },
    [fetchTasks, onSuccess]
  )

  // Archived lead tasks have nowhere else to live: project archive routes are
  // project-scoped and a lead task has no project (D18/C11). Without this
  // grouping, archiving one would remove it from the UI permanently.
  const archivedTasks = tasks.filter(t => t.deletedAt !== null)
  const liveTasks = tasks.filter(t => t.deletedAt === null)
  const completedTasks = liveTasks.filter(
    t => t.status === 'DONE' || t.status === 'ARCHIVED'
  )
  const activeTasks = liveTasks.filter(
    t => t.status !== 'DONE' && t.status !== 'ARCHIVED'
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Tasks</span>
          {tasks.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {tasks.length}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openNew('task')}
          >
            <Plus className="mr-1 h-3 w-3" />
            Create
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks linked to this lead yet.</p>
      ) : (
        <div className="space-y-2">
          {/* Active tasks */}
          {activeTasks.length > 0 && (
            <div className="space-y-2">
              {activeTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div className="space-y-2">
              {activeTasks.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground pt-2">Completed</p>
              )}
              {completedTasks.slice(0, 3).map(task => (
                <TaskCard key={task.id} task={task} isCompleted />
              ))}
              {completedTasks.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{completedTasks.length - 3} more completed tasks
                </p>
              )}
            </div>
          )}

          {/* Archived tasks (D18) — collapsed, each restorable. */}
          {archivedTasks.length > 0 && (
            <details className="space-y-2 pt-2">
              <summary className="text-muted-foreground cursor-pointer text-xs font-medium">
                Archived ({archivedTasks.length})
              </summary>
              <div className="mt-2 space-y-2">
                {restoreError && (
                  <p role="alert" className="text-destructive text-xs">
                    {restoreError}
                  </p>
                )}
                {archivedTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isArchived
                    canRestore={canManage}
                    isRestoring={isRestoring}
                    onRestore={() => handleRestore(task.id)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  ON_DECK: 'On Deck',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  ARCHIVED: 'Archived',
}

const STATUS_COLORS: Record<string, string> = {
  ON_DECK: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  BLOCKED: 'bg-red-500/10 text-red-600 border-red-500/20',
  DONE: 'bg-green-500/10 text-green-600 border-green-500/20',
  ARCHIVED: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
}

function TaskCard({
  task,
  isCompleted = false,
  isArchived = false,
  canRestore = false,
  isRestoring = false,
  onRestore,
}: {
  task: LeadTask
  isCompleted?: boolean
  isArchived?: boolean
  canRestore?: boolean
  isRestoring?: boolean
  onRestore?: () => void
}) {
  const statusLabel = STATUS_LABELS[task.status] ?? task.status
  const statusColor = STATUS_COLORS[task.status] ?? 'bg-slate-500/10 text-slate-600'

  return (
    <div
      className={`rounded-lg border p-3 ${
        isArchived
          ? 'bg-muted/10 border-dashed opacity-60'
          : isCompleted
            ? 'bg-muted/20 opacity-70'
            : 'bg-muted/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
            <p className={`truncate text-sm font-medium ${isCompleted ? 'line-through' : ''}`}>
              {task.title}
            </p>
          </div>
          <div className="mt-1 ml-6 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs ${statusColor}`}>
              {statusLabel}
            </Badge>
            {task.dueOn && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {formatCalendarDate(task.dueOn, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isArchived && canRestore && onRestore && (
            <button
              type="button"
              onClick={onRestore}
              disabled={isRestoring}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label={`Restore task: ${task.title}`}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <a
            href={myTaskHref(task.id)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Open task: ${task.title}`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  )
}
