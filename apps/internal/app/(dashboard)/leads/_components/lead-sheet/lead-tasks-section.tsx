'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ListTodo, Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@pts/ui/skeleton'
import { TaskCardStatic } from '@/app/(dashboard)/projects/task-card'
import type { LeadRecord } from '@/lib/leads/types'
import type { TaskWithRelations } from '@/lib/types'
import { NEW_SHEET_VALUE } from '@/lib/sheets/entities'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { prefetchSheetInit } from '@/lib/sheets/wrappers/use-sheet-init'

type AssigneeInfo = {
  id: string
  name: string
  avatarUrl: string | null
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
  const { open, openNew, get } = useSheetParams()
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [assigneesById, setAssigneesById] = useState<
    Record<string, AssigneeInfo>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const taskParam = get('task')

  const fetchTasks = useCallback(() => {
    // Promise-chained (not awaited inline) so every setState runs
    // asynchronously, even if fetch itself throws synchronously.
    return fetch(`/api/leads/${lead.id}/tasks`)
      .then(async response => {
        if (response.ok) {
          const data = await response.json()
          setTasks(data.tasks ?? [])
          setAssigneesById(data.assignees ?? {})
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
  // task created or edited there shows up here. This runs in an effect, not
  // the adjust-during-render pattern: `onSuccess` sets state in the parent,
  // and updating another component during render is illegal.
  const previousTaskParamRef = useRef(taskParam)
  useEffect(() => {
    const previous = previousTaskParamRef.current
    previousTaskParamRef.current = taskParam

    if (previous !== null && taskParam === null) {
      void fetchTasks()
      onSuccess?.()
    }
  }, [fetchTasks, onSuccess, taskParam])

  const resolveAssignees = useCallback(
    (task: TaskWithRelations): AssigneeInfo[] =>
      task.assignees
        .map(assignee => assigneesById[assignee.user_id])
        .filter((info): info is AssigneeInfo => Boolean(info)),
    [assigneesById]
  )

  // Stacks the task sheet over this lead sheet (`?lead=…&task=…`) instead of
  // navigating away — closing the task drops back to the lead.
  const openTask = useCallback(
    (task: TaskWithRelations) => open('task', task.id),
    [open]
  )

  const completedTasks = tasks.filter(
    t => t.status === 'DONE' || t.status === 'ARCHIVED'
  )
  const activeTasks = tasks.filter(
    t => t.status !== 'DONE' && t.status !== 'ARCHIVED'
  )

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <ListTodo className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Tasks</span>
          {tasks.length > 0 && (
            <Badge variant='secondary' className='text-xs'>
              {tasks.length}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => openNew('task')}
          >
            <Plus className='h-3 w-3' />
            Create
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className='space-y-2'>
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-24 w-full' />
        </div>
      ) : tasks.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          No tasks linked to this lead yet.
        </p>
      ) : (
        <div className='space-y-2'>
          {activeTasks.length > 0 && (
            <div className='space-y-2'>
              {activeTasks.map(task => (
                <TaskCardStatic
                  key={task.id}
                  task={task}
                  assignees={resolveAssignees(task)}
                  onClick={() => openTask(task)}
                />
              ))}
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className='space-y-2'>
              {activeTasks.length > 0 && (
                <p className='text-muted-foreground pt-2 text-xs font-medium'>
                  Completed
                </p>
              )}
              {completedTasks.slice(0, 3).map(task => (
                <TaskCardStatic
                  key={task.id}
                  task={task}
                  assignees={resolveAssignees(task)}
                  onClick={() => openTask(task)}
                />
              ))}
              {completedTasks.length > 3 && (
                <p className='text-muted-foreground text-xs'>
                  +{completedTasks.length - 3} more completed tasks
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
