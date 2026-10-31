import { X } from 'lucide-react'

import { RowActionButton } from '@pts/ui/row-action-button'
import { SheetRecordRow } from '@/components/sheets/sheet-record-row'
import type { PendingRemovalRow } from '@/components/sheets/use-pending-removals'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import type { TaskWithRelations } from '@/lib/types'

import { formatTaskStatusLabel } from './task-status-utils'

export type SelectedTaskListProps = {
  /** Linked tasks, unlinked ones in place as Pending removal. */
  rows: PendingRemovalRow<TaskWithRelations>[]
  isActionDisabled: boolean
  disabledReason: string | null
  onRemove: (task: TaskWithRelations) => void
  onUndo: (task: TaskWithRelations) => void
}

/** The time log's linked tasks, as task cards. */
export function SelectedTaskList(props: SelectedTaskListProps) {
  const { rows, isActionDisabled, disabledReason, onRemove, onUndo } = props

  return (
    <>
      {rows.map(({ item: task, pending }) => (
        <SheetRecordRow
          key={task.id}
          icon={ENTITY_ICONS.task}
          title={task.title}
          description={formatTaskStatusLabel(task.status) || null}
          pendingRemoval={
            pending
              ? { disabled: isActionDisabled, onUndo: () => onUndo(task) }
              : undefined
          }
          actions={
            <DisabledFieldTooltip
              disabled={isActionDisabled}
              reason={disabledReason}
            >
              <RowActionButton
                type='button'
                label={`Remove ${task.title}`}
                icon={<X />}
                className='text-muted-foreground hover:text-destructive'
                onClick={() => onRemove(task)}
                disabled={isActionDisabled}
              />
            </DisabledFieldTooltip>
          }
        />
      ))}
    </>
  )
}
