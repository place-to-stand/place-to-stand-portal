import { differenceInCalendarDays, parseISO } from 'date-fns'

import { companyCalendarDate, formatCalendarDate } from '@pts/ui/dates'

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
  /** For tests; defaults to the current time. */
  now?: Date
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

  // Today in the company's time zone, not the machine's: the server (UTC)
  // and the browser must agree, or the label differs between the server
  // render and hydration. In the evening UTC is already tomorrow, and that
  // mismatch made React render the whole page again, wiping dark mode.
  const today = parseISO(companyCalendarDate(options.now))
  const daysUntilDue = differenceInCalendarDays(parsed, today)

  if (daysUntilDue === 0) {
    return { label: 'Due today', tone: 'caution' }
  }

  if (daysUntilDue === 1) {
    return { label: 'Due tomorrow', tone: 'caution' }
  }

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
