import type { ReactElement } from 'react'

import { SearchableCombobox } from '@/components/ui/searchable-combobox'
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

/** The section's + opens the shared picker, hanging from its right edge. */
export function TaskSelector(props: TaskSelectorProps) {
  const { availableTasks, onAddTask, isOpen, onOpenChange, trigger } = props

  return (
    <SearchableCombobox
      trigger={trigger}
      open={isOpen}
      onOpenChange={onOpenChange}
      value={null}
      onChange={onAddTask}
      ariaLabel='Add task'
      searchPlaceholder='Search tasks…'
      emptyMessage='No matching tasks.'
      groups={[
        {
          label: 'Tasks',
          items: availableTasks.map(task => ({
            value: task.id,
            label: task.title,
            description: formatTaskStatusLabel(task.status) || undefined,
          })),
        },
      ]}
    />
  )
}
