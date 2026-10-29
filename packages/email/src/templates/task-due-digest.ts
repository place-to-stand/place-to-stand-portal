import { renderBlocks, type EmailBlock, type EmailListItem } from '../blocks'
import { renderRichEmail, type RenderedEmail } from '../layout'

export type TaskDueDigestItem = {
  title: string
  /** "Acme Co. · Sales", the lead (if any) and the project. */
  context: string
  /** "3 days late", "Due today". */
  dueLabel: string
}

export type TaskDueDigestEmailArgs = {
  /** First name, for the greeting. */
  recipientName: string
  /** "Thursday, October 29". */
  dateLabel: string
  late: TaskDueDigestItem[]
  dueToday: TaskDueDigestItem[]
  /** Deep link to the recipient's task board. */
  tasksUrl: string
  replyTo: string
}

function toListItems(items: TaskDueDigestItem[]): EmailListItem[] {
  return items.map(item => ({
    title: item.title,
    detail: item.context,
    note: item.dueLabel,
  }))
}

function countLine(late: number, today: number): string {
  const parts: string[] = []
  if (late) parts.push(`${late} late`)
  if (today) parts.push(`${today} due today`)
  return parts.join(', ')
}

/**
 * Morning email listing the recipient's open tasks that are late or due
 * today. Only sent when at least one list has something on it, so it never
 * arrives empty.
 */
export function taskDueDigestEmail({
  recipientName,
  dateLabel,
  late,
  dueToday,
  tasksUrl,
  replyTo,
}: TaskDueDigestEmailArgs): RenderedEmail {
  const summary = countLine(late.length, dueToday.length)

  const blocks: EmailBlock[] = [
    { type: 'heading', text: `Morning, ${recipientName}` },
    {
      type: 'paragraph',
      text: `Here's what needs you today: ${summary}.`,
    },
    ...(late.length
      ? ([
          { type: 'label', text: `Late · ${late.length}` },
          { type: 'list', items: toListItems(late) },
        ] satisfies EmailBlock[])
      : []),
    ...(dueToday.length
      ? ([
          { type: 'label', text: `Due today · ${dueToday.length}` },
          { type: 'list', items: toListItems(dueToday) },
        ] satisfies EmailBlock[])
      : []),
    { type: 'button', label: 'Open my tasks', url: tasksUrl },
  ]

  const body = renderBlocks(blocks)

  return renderRichEmail(`Your tasks for ${dateLabel}: ${summary}`, {
    preheader: `${summary}. ${[...late, ...dueToday][0]?.title ?? ''}`.trim(),
    label: 'Tasks due',
    bodyHtml: body.html,
    bodyText: body.text,
    footerLead: 'Questions about this email? Write to',
    replyTo,
  })
}
