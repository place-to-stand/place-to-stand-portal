'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pts/ui/collapsible'
import { Badge } from '@pts/ui/badge'
import { Skeleton } from '@pts/ui/skeleton'
import { EntityList } from '@/components/sheets/entity-list'
import { cn } from '@/lib/utils'
import { TaskCardStatic } from '@/app/(dashboard)/projects/task-card'
import type { LeadRecord } from '@/lib/leads/types'
import type { TaskWithRelations } from '@/lib/types'
import { NEW_SHEET_VALUE } from '@/lib/sheets/entities'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { prefetchSheetInit } from '@/lib/sheets/wrappers/use-sheet-init'
import { ENTITY_ICONS } from '@/lib/entity-accents'

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
  // False for a sales user who isn't a member of the Sales project, where
  // every lead task lives: they can't see (or create) any.
  const [inSalesProject, setInSalesProject] = useState(true)
  // Closed by default: completed tasks only grow over the life of a lead, and
  // left open they push the Updates timeline below the fold.
  const [showCompleted, setShowCompleted] = useState(false)
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
          setInSalesProject(data.inSalesProject !== false)
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

  const completedTasks = tasks.filter(t => t.status === 'DONE')
  const activeTasks = tasks.filter(t => t.status !== 'DONE')

  return (
    <EntityList
      title='Tasks'
      icon={ENTITY_ICONS.task}
      titleAddon={
        tasks.length > 0 ? (
          <Badge variant='secondary'>{tasks.length}</Badge>
        ) : null
      }
      add={
        canManage
          ? {
              label: 'Add task',
              onAdd: () => openNew('task'),
              disabledReason: inSalesProject
                ? null
                : 'Ask an admin to add you to the Sales project.',
            }
          : undefined
      }
      isEmpty={tasks.length === 0}
      emptyMessage={
        inSalesProject
          ? 'No tasks linked to this lead yet.'
          : 'Lead tasks live in the Sales project. Ask an admin to add you to it to see and create them.'
      }
      status={
        isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-24 w-full' />
            <Skeleton className='h-24 w-full' />
          </div>
        ) : undefined
      }
    >
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
        <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
          <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-1.5 pt-2 text-xs font-medium'>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                showCompleted ? 'rotate-0' : '-rotate-90'
              )}
              aria-hidden='true'
            />
            Completed ({completedTasks.length})
          </CollapsibleTrigger>
          <CollapsibleContent className='space-y-2 pt-2'>
            {completedTasks.map(task => (
              <TaskCardStatic
                key={task.id}
                task={task}
                assignees={resolveAssignees(task)}
                onClick={() => openTask(task)}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </EntityList>
  )
}
