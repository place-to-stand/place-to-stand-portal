
import { TableCell } from '@pts/ui/table'
import { CONCEPT_ICONS } from '@/lib/concept-icons'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/lib/types'

import type { RenderAssigneeFn } from '../../../../../../lib/projects/board/board-selectors'
import {
  formatDueDate,
  formatUpdatedAt,
  summarizeAssignees,
} from './review-tab-helpers'

type ReviewTaskDataCellsProps = {
  task: TaskWithRelations
  renderAssignees: RenderAssigneeFn
  updatedAtOverride?: string | null | undefined
}

export function ReviewTaskDataCells({
  task,
  renderAssignees,
  updatedAtOverride,
}: ReviewTaskDataCellsProps) {
  const commentCount = task.commentCount ?? 0
  const attachmentCount = task.attachmentCount ?? task.attachments?.length ?? 0
  const assignedSummary = summarizeAssignees(task, renderAssignees)
  const updatedValue = updatedAtOverride ?? task.updated_at ?? null

  return (
    <>
      <TableCell className='align-top max-md:whitespace-normal'>
        <div className='flex flex-col gap-1'>
          <span className='text-sm leading-snug font-medium'>{task.title}</span>
          <span className='text-muted-foreground text-xs'>
            {assignedSummary}
          </span>
        </div>
      </TableCell>
      <TableCell
        className={cn(
          'text-muted-foreground text-center text-xs',
          commentCount === 0 && 'max-md:hidden'
        )}
      >
        {commentCount > 0 ? (
          <span className='inline-flex items-center gap-1'>
            <CONCEPT_ICONS.comment className='h-3.5 w-3.5' />
            {commentCount}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell
        className={cn(
          'text-muted-foreground text-center text-xs',
          attachmentCount === 0 && 'max-md:hidden'
        )}
      >
        {attachmentCount > 0 ? (
          <span className='inline-flex items-center gap-1'>
            <CONCEPT_ICONS.attachment className='h-3.5 w-3.5' />
            {attachmentCount}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell label='Due' className='text-muted-foreground text-sm'>
        {formatDueDate(task.due_on ?? null)}
      </TableCell>
      <TableCell label='Updated' className='text-muted-foreground text-sm'>
        {formatUpdatedAt(updatedValue)}
      </TableCell>
    </>
  )
}
