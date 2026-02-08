'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ListTodo, Plus, Calendar, ExternalLink, CheckCircle2, Circle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeadRecord, LeadAssigneeOption } from '@/lib/leads/types'

import { LeadTaskSheetOverlay } from './lead-task-sheet-overlay'

type LeadTask = {
  id: string
  title: string
  status: string
  dueOn: string | null
  createdAt: string
}

type LeadTasksSectionProps = {
  lead: LeadRecord
  assignees: LeadAssigneeOption[]
  canManage: boolean
  onSuccess?: () => void
}

// Note: assignees prop is kept for backward compatibility but not used by LeadTaskSheetOverlay

export function LeadTasksSection({
  lead,
  canManage,
  onSuccess,
}: LeadTasksSectionProps) {
  const [isDialogOpen, setDialogOpen] = useState(false)
  const [tasks, setTasks] = useState<LeadTask[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(`/api/leads/${lead.id}/tasks`)
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks ?? [])
      }
    } catch (error) {
      console.error('Failed to fetch lead tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleTaskSheetSuccess = useCallback(() => {
    fetchTasks()
    onSuccess?.()
  }, [fetchTasks, onSuccess])

  const completedTasks = tasks.filter(t => t.status === 'DONE' || t.status === 'ARCHIVED')
  const activeTasks = tasks.filter(t => t.status !== 'DONE' && t.status !== 'ARCHIVED')

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
            onClick={() => setDialogOpen(true)}
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
        </div>
      )}

      <LeadTaskSheetOverlay
        open={isDialogOpen}
        onOpenChange={setDialogOpen}
        lead={lead}
        canManage={canManage}
        onSuccess={handleTaskSheetSuccess}
      />
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  ON_DECK: 'On Deck',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  ARCHIVED: 'Archived',
}

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  ON_DECK: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  IN_REVIEW: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  BLOCKED: 'bg-red-500/10 text-red-600 border-red-500/20',
  DONE: 'bg-green-500/10 text-green-600 border-green-500/20',
  ARCHIVED: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
}

function TaskCard({
  task,
  isCompleted = false,
}: {
  task: LeadTask
  isCompleted?: boolean
}) {
  const statusLabel = STATUS_LABELS[task.status] ?? task.status
  const statusColor = STATUS_COLORS[task.status] ?? 'bg-slate-500/10 text-slate-600'

  return (
    <div
      className={`rounded-lg border p-3 ${isCompleted ? 'bg-muted/20 opacity-70' : 'bg-muted/30'}`}
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
                {format(new Date(task.dueOn), 'MMM d')}
              </span>
            )}
          </div>
        </div>
        <a
          href={`/my-tasks?taskId=${task.id}`}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Open task: ${task.title}`}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}
