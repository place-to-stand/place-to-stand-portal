import { formatCalendarDate, formatRelativeTime } from '@pts/ui/dates'

import type { TaskWithRelations } from '@/lib/types'
import type { RenderAssigneeFn } from '../../../../../../lib/projects/board/board-selectors'

const FALLBACK_DASH = '—'

export const formatDueDate = (value: string | null | undefined) => {
  if (!value) {
    return FALLBACK_DASH
  }

  return formatCalendarDate(value) ?? value
}

export const formatUpdatedAt = (value: string | null | undefined) => {
  if (!value) {
    return FALLBACK_DASH
  }

  return formatRelativeTime(value) ?? value
}

export const summarizeAssignees = (
  task: TaskWithRelations,
  renderAssignees: RenderAssigneeFn
) => {
  const assignees = renderAssignees(task)
  if (!assignees.length) {
    return 'Unassigned'
  }

  return assignees.map(person => person.name).join(', ')
}
