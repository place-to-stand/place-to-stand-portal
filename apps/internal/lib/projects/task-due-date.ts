import {
  differenceInCalendarDays,
  isToday,
  isTomorrow,
  parseISO,
} from 'date-fns'

import { formatCalendarDate } from '@pts/ui/dates'

const SHORT_DAY = { month: 'short', day: 'numeric' } as const

export const TASK_DUE_TONE_CLASSES = {
  default: 'text-muted-foreground',
  caution: 'text-warning',
  overdue: 'text-destructive font-medium',
} as const

type TaskDueTone = keyof typeof TASK_DUE_TONE_CLASSES

export type TaskDueMeta = {
  label: string
  tone: TaskDueTone
}

type TaskDueMetaOptions = {
  status?: string | null
}

export function getTaskDueMeta(
  dueOn: string | null,
  options: TaskDueMetaOptions = {}
): TaskDueMeta {
  if (!dueOn) {
    return { label: 'No set due date', tone: 'default' }
  }

  const parsed = parseISO(dueOn)

  if (Number.isNaN(parsed.getTime())) {
    return { label: dueOn, tone: 'default' }
  }

  const normalizedStatus = options.status?.toUpperCase() ?? null
  const isDone = normalizedStatus === 'DONE'

  if (isDone) {
    return {
      label: `Due ${formatCalendarDate(dueOn, SHORT_DAY)}`,
      tone: 'default',
    }
  }

  if (isToday(parsed)) {
    return { label: 'Due today', tone: 'caution' }
  }

  if (isTomorrow(parsed)) {
    return { label: 'Due tomorrow', tone: 'caution' }
  }

  const daysUntilDue = differenceInCalendarDays(parsed, new Date())

  if (daysUntilDue < 0) {
    return {
      label: `Overdue - ${formatCalendarDate(dueOn)}`,
      tone: 'overdue',
    }
  }

  if (daysUntilDue <= 3) {
    return {
      label: `Due ${formatCalendarDate(dueOn, SHORT_DAY)}`,
      tone: 'caution',
    }
  }

  return {
    label: `Due ${formatCalendarDate(dueOn, SHORT_DAY)}`,
    tone: 'default',
  }
}
