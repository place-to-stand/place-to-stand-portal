import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { unstable_rethrow } from 'next/navigation'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  companies,
  contacts,
  leads,
  taskAssignees,
  tasks,
  users,
} from '@/lib/db/schema'
import { LEAD_STATUS_LABELS, type LeadStatusValue } from '@/lib/leads/constants'
import { findBlockedAssignees } from '@/lib/projects/access'
import { htmlToPlainText } from '@/lib/activity/text-diff'
import {
  addedMentionIds,
  excerptAround,
  mentionLabel,
} from '@/lib/rich-text/mentions'
import { sanitizeRichTextHtml } from '@/lib/rich-text/sanitize-server'
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
    // A redirect or notFound from inside must still reach Next.
    unstable_rethrow(error)
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

/**
 * Who hears about a task: its live assignees and the person who created it,
 * as long as they can still open it (an assignee removed from the project,
 * or without lead task access, isn't told). The actor is dropped later.
 */
async function taskFollowers(taskId: string) {
  const [task] = await db
    .select({ projectId: tasks.projectId, createdBy: tasks.createdBy })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1)
  if (!task) return []
  const assigned = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(
      and(eq(taskAssignees.taskId, taskId), isNull(taskAssignees.deletedAt))
    )
  const ids = new Set(assigned.map(row => row.userId))
  if (task.createdBy) ids.add(task.createdBy)
  const staff = await staffRecipients([...ids])
  const blocked = new Set(
    (await findBlockedAssignees(task.projectId, staff)).map(person => person.id)
  )
  return staff.filter(userId => !blocked.has(userId))
}

export function notifyTaskComment(
  actor: AppUser,
  task: { id: string; title: string },
  excerpt: string,
  /** People already told by a mention in this comment: one notice each. */
  skip: readonly string[] = []
) {
  return bestEffort('task comment', async () => {
    const recipients = (await taskFollowers(task.id)).filter(
      userId => !skip.includes(userId)
    )
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

/** The task statuses worth a notification: work stopped, or work finished. */
const NOTIFIED_TASK_STATUSES = { BLOCKED: 'blocked', DONE: 'done' } as const

/** Someone else marked a task you're on, or made, Blocked or Done. */
export function notifyTaskStatusChanged(
  actor: AppUser,
  task: { id: string; title: string },
  toStatus: string
) {
  const word =
    NOTIFIED_TASK_STATUSES[toStatus as keyof typeof NOTIFIED_TASK_STATUSES]
  if (!word) return Promise.resolve()
  return bestEffort('task status', async () => {
    const recipients = await taskFollowers(task.id)
    await createNotifications(
      recipients.map(userId => ({
        userId,
        type: 'task_status',
        title: `${actorName(actor)} marked ${task.title} ${word}`,
        href: myTaskHref(task.id),
        actorId: actor.id,
      }))
    )
  })
}

/** A live lead's name for a notification (its contact, else its company). */
async function leadName(leadId: string) {
  const [row] = await db
    .select({ contactName: contacts.name, companyName: companies.name })
    .from(leads)
    .leftJoin(contacts, eq(contacts.id, leads.contactId))
    .leftJoin(companies, eq(companies.id, leads.companyId))
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)
  if (!row) return null
  return row.contactName ?? row.companyName ?? 'a lead'
}

/** A lead's owner and how to name it in a notification. */
async function leadNotice(leadId: string) {
  const [row] = await db
    .select({
      assigneeId: leads.assigneeId,
      contactName: contacts.name,
      companyName: companies.name,
    })
    .from(leads)
    .leftJoin(contacts, eq(contacts.id, leads.contactId))
    .leftJoin(companies, eq(companies.id, leads.companyId))
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)
  if (!row?.assigneeId) return null
  const name = row.contactName ?? row.companyName ?? 'a lead'
  return { assigneeId: row.assigneeId, name }
}

/** Someone else logged an update (a call, an email, a note) on your lead. */
export function notifyLeadUpdate(
  actor: AppUser,
  leadId: string,
  typeLabel: string,
  excerpt: string,
  /** People already told by a mention in this update: one notice each. */
  skip: readonly string[] = []
) {
  return bestEffort('lead update', async () => {
    const lead = await leadNotice(leadId)
    if (!lead) return
    const recipients = (await staffRecipients([lead.assigneeId])).filter(
      userId => !skip.includes(userId)
    )
    const kind = typeLabel.toLowerCase()
    const article = /^[aeiou]/.test(kind) ? 'an' : 'a'
    await createNotifications(
      recipients.map(userId => ({
        userId,
        type: 'lead_update',
        title: `${actorName(actor)} logged ${article} ${kind} on ${lead.name}`,
        body: excerpt || null,
        href: leadHref(leadId),
        actorId: actor.id,
      }))
    )
  })
}

/** Someone else moved your lead to another stage. */
export function notifyLeadStageMoved(
  actor: AppUser,
  leadId: string,
  toStatus: LeadStatusValue
) {
  return bestEffort('lead stage', async () => {
    const lead = await leadNotice(leadId)
    if (!lead) return
    const recipients = await staffRecipients([lead.assigneeId])
    await createNotifications(
      recipients.map(userId => ({
        userId,
        type: 'lead_stage',
        title: `${actorName(actor)} moved ${lead.name} to ${LEAD_STATUS_LABELS[toStatus]}`,
        href: leadHref(leadId),
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

/** About 140 characters of the text around this person's mention. */
function mentionExcerpt(html: string, userId: string) {
  const label = mentionLabel(html, userId)
  return excerptAround(htmlToPlainText(html), label ? `@${label}` : null)
}

/**
 * What the mention is in: a task or lead, and `text`, which of its texts
 * (`description`, `notes`, `comment:<id>`, `update:<id>`). A person is told
 * once per text, so removing and re-adding a mention doesn't ping again.
 */
export type MentionTarget =
  | { kind: 'task'; id: string; title: string; text: string }
  | { kind: 'lead'; id: string; text: string }

/**
 * Tells each person newly @mentioned in `html` (and not in `previousHtml`),
 * when they can open the task or lead. Never the actor. Returns who was
 * told, so a comment or update notice can skip them (one notice, not two).
 */
export async function notifyMentions(
  actor: AppUser,
  target: MentionTarget,
  html: string | null | undefined,
  previousHtml: string | null | undefined = null,
  skip: readonly string[] = []
): Promise<string[]> {
  // Read what the page shows: a mention hidden in a comment or a stripped
  // tag never reaches anyone.
  const clean = html ? sanitizeRichTextHtml(html) : ''
  const before = previousHtml ? sanitizeRichTextHtml(previousHtml) : null
  const added = addedMentionIds(clean, before).filter(
    id => id !== actor.id && !skip.includes(id)
  )
  if (!added.length) return []
  let told: string[] = []
  await bestEffort('mention', async () => {
    const staff = await staffRecipients(added)
    if (target.kind === 'task') {
      const [task] = await db
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(and(eq(tasks.id, target.id), isNull(tasks.deletedAt)))
        .limit(1)
      if (!task) return
      const blocked = new Set(
        (await findBlockedAssignees(task.projectId, staff)).map(
          person => person.id
        )
      )
      const recipients = staff.filter(userId => !blocked.has(userId))
      await createNotifications(
        recipients.map(userId => ({
          userId,
          type: 'task_mention',
          title: `${actorName(actor)} mentioned you in ${target.title}`,
          body: mentionExcerpt(clean, userId) || null,
          href: myTaskHref(target.id),
          actorId: actor.id,
          dedupeKey: `mention:task:${target.id}:${target.text}`,
        }))
      )
      // Only once the notices exist, so a failed insert skips no one.
      told = recipients
      return
    }
    const name = await leadName(target.id)
    if (!name) return
    await createNotifications(
      staff.map(userId => ({
        userId,
        type: 'lead_mention',
        title: `${actorName(actor)} mentioned you on ${name}`,
        body: mentionExcerpt(clean, userId) || null,
        href: leadHref(target.id),
        actorId: actor.id,
        dedupeKey: `mention:lead:${target.id}:${target.text}`,
      }))
    )
    told = staff
  })
  return told
}
