import type { TaskDueDigestItem } from '@pts/email'

export type DueDigestTask = {
  title: string
  dueOn: string
  projectName: string
  leadName: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS
  )
}

/** "Thursday, October 29" for a YYYY-MM-DD date. */
export function formatDigestDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Splits a person's due tasks into late and due-today lists, latest first,
 * shaped for the email template.
 */
export function buildDueDigestLists(tasks: DueDigestTask[], today: string) {
  const late: Array<{ item: TaskDueDigestItem; days: number }> = []
  const dueToday: TaskDueDigestItem[] = []

  for (const task of tasks) {
    const context = task.leadName
      ? `${task.leadName} · ${task.projectName}`
      : task.projectName
    const daysLate = daysBetween(task.dueOn, today)

    if (daysLate > 0) {
      late.push({
        item: {
          title: task.title,
          context,
          dueLabel: `${daysLate} ${daysLate === 1 ? 'day' : 'days'} late`,
        },
        days: daysLate,
      })
    } else if (daysLate === 0) {
      dueToday.push({ title: task.title, context, dueLabel: 'Due today' })
    }
  }

  late.sort((a, b) => b.days - a.days)

  return {
    late: late.map(entry => entry.item),
    dueToday,
  }
}

/** First word of a full name, else the part of the email before the @. */
export function greetingName(fullName: string | null, email: string): string {
  const first = fullName?.trim().split(/\s+/)[0]
  return first || email.split('@')[0]
}
