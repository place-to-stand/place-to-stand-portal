import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { taskAssignees, users } from '@/lib/db/schema'
import { leadHref, myTaskHref } from '@/lib/sheets/hrefs'

import { createNotifications } from './queries'

/**
 * Producers for in-app notifications. Each one is best-effort: a failure is
 * logged and swallowed, because a missed notification must never fail the
 * save that triggered it.
 */
async function bestEffort(label: string, work: () => Promise<void>) {
  try {
    await work()
  } catch (error) {
    console.error(`Failed to create ${label} notification`, error)
  }
}

function actorName(actor: AppUser) {
  return actor.full_name?.trim() || actor.email
}

/** Only live staff get notifications (a client or disabled user never sees them). */
async function staffRecipients(userIds: readonly string[]) {
  if (!userIds.length) return []
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.id, [...userIds]),
        inArray(users.role, ['ADMIN', 'SALES']),
        isNull(users.deletedAt),
        isNull(users.disabledAt)
      )
    )
  return rows.map(row => row.id)
}

export function notifyTaskAssigned(
  actor: AppUser,
  task: { id: string; title: string },
  newAssigneeIds: readonly string[]
) {
  return bestEffort('task assigned', async () => {
    const recipients = await staffRecipients(newAssigneeIds)
    await createNotifications(
      recipients.map(userId => ({
        userId,
        type: 'task_assigned',
        title: `${actorName(actor)} assigned you a task`,
        body: task.title,
        href: myTaskHref(task.id),
        actorId: actor.id,
      }))
    )
  })
}

export function notifyTaskComment(
  actor: AppUser,
  task: { id: string; title: string },
  excerpt: string
) {
  return bestEffort('task comment', async () => {
    const assigned = await db
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(
        and(eq(taskAssignees.taskId, task.id), isNull(taskAssignees.deletedAt))
      )
    const recipients = await staffRecipients(assigned.map(row => row.userId))
    await createNotifications(
      recipients.map(userId => ({
        userId,
        type: 'task_comment',
        title: `${actorName(actor)} commented on ${task.title}`,
        body: excerpt,
        href: myTaskHref(task.id),
        actorId: actor.id,
      }))
    )
  })
}

export function notifyLeadAssigned(
  actor: AppUser,
  lead: { id: string; contactName: string; companyName: string | null },
  assigneeId: string
) {
  return bestEffort('lead assigned', async () => {
    const recipients = await staffRecipients([assigneeId])
    await createNotifications(
      recipients.map(userId => ({
        userId,
        type: 'lead_assigned',
        title: `${actorName(actor)} assigned you a lead`,
        body: lead.companyName
          ? `${lead.contactName} · ${lead.companyName}`
          : lead.contactName,
        href: leadHref(lead.id),
        actorId: actor.id,
      }))
    )
  })
}
