'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pts/ui/select'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useToast } from '@/components/ui/use-toast'
import { getTaskStatusLabel, getTaskStatusToken } from '@/lib/projects/task-status'
import { TASK_STATUSES } from '@/app/(dashboard)/projects/actions/shared-schemas'

import { selectExistingTaskForSession } from '../actions/select-task'
import type { AgentTaskSummary } from '@/lib/agents/types'

type ProjectOption = { id: string; name: string }

const ALL_STATUSES_VALUE = 'all'

type AgentTaskBrowserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  tasks: AgentTaskSummary[]
  projectOptions: ProjectOption[]
}

/**
 * The "browse all tasks and link one" surface — a ⌘K-style overlay
 * (triggered by the search button in AgentTaskPanel) instead of a table
 * permanently docked in the 380px rail.
 */
export function AgentTaskBrowserDialog({
  open,
  onOpenChange,
  sessionId,
  tasks,
  projectOptions,
}: AgentTaskBrowserDialogProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES_VALUE)
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const projectNameById = useMemo(
    () => new Map(projectOptions.map(project => [project.id, project.name])),
    [projectOptions]
  )

  const filteredTasks = useMemo(
    () => (statusFilter === ALL_STATUSES_VALUE ? tasks : tasks.filter(task => task.status === statusFilter)),
    [tasks, statusFilter]
  )

  const handleAdd = useCallback(
    (taskId: string) => {
      setAddingTaskId(taskId)
      startTransition(async () => {
        const result = await selectExistingTaskForSession({ sessionId, taskId })
        setAddingTaskId(null)
        if ('error' in result) {
          toast({ variant: 'destructive', title: 'Error', description: result.error })
          return
        }
        onOpenChange(false)
        router.refresh()
      })
    },
    [sessionId, toast, router, onOpenChange]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Link a task'
      description='Search all tasks and select one to link to this session.'
    >
      <CommandInput placeholder='Search tasks...' />
      <div className='flex items-center justify-end border-b px-3 py-1.5'>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='h-6 w-[140px] text-xs'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
            {TASK_STATUSES.map(status => (
              <SelectItem key={status} value={status}>
                {getTaskStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CommandList>
        <CommandEmpty>No matching tasks.</CommandEmpty>
        <CommandGroup>
          {filteredTasks.map(task => {
            const isAdding = isPending && addingTaskId === task.id
            return (
              <CommandItem
                key={task.id}
                value={`${task.title} ${projectNameById.get(task.projectId) ?? ''}`}
                onSelect={() => handleAdd(task.id)}
                disabled={isAdding}
              >
                <div className='flex min-w-0 flex-1 flex-col'>
                  <span className='truncate'>{task.title}</span>
                  <span className='truncate text-xs text-muted-foreground'>
                    {projectNameById.get(task.projectId) ?? 'Unknown project'}
                  </span>
                </div>
                <Badge variant='outline' className={getTaskStatusToken(task.status)}>
                  {getTaskStatusLabel(task.status)}
                </Badge>
                {isAdding ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Plus className='h-3.5 w-3.5' />}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
