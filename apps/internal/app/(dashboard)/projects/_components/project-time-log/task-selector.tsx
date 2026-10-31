import type { ReactElement } from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import type { TaskWithRelations } from '@/lib/types'

import { formatTaskStatusLabel } from './task-status-utils'

export type TaskSelectorProps = {
  availableTasks: TaskWithRelations[]
  onAddTask: (taskId: string) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** The section's + (from `EntityList`). */
  trigger: ReactElement
}

export function TaskSelector(props: TaskSelectorProps) {
  const { availableTasks, onAddTask, isOpen, onOpenChange, trigger } = props

  return (
    // The section's + opens the list, hanging from its right edge.
    <Popover open={isOpen} onOpenChange={onOpenChange} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align='end' sideOffset={4} className='w-80 p-0'>
        <Command>
          <CommandInput placeholder='Search tasks…' />
          <CommandEmpty>No matching tasks.</CommandEmpty>
          <CommandList>
            <CommandGroup heading='Tasks'>
              {availableTasks.map(task => {
                const formattedStatus = formatTaskStatusLabel(task.status)

                return (
                  <CommandItem
                    key={task.id}
                    value={`${task.title} ${task.id}`}
                    onSelect={() => {
                      onAddTask(task.id)
                      onOpenChange(false)
                    }}
                  >
                    <div className='flex flex-col'>
                      <span className='font-medium'>{task.title}</span>
                      {formattedStatus ? (
                        <span className='text-muted-foreground text-xs'>
                          {formattedStatus}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
