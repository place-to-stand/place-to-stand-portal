import 'server-only'

import { createHash } from 'node:crypto'

import { and, eq, inArray, isNull, lte, ne, sql } from 'drizzle-orm'

import { taskDueDigestEmail } from '@pts/email'
import { db } from '@/lib/db'
import { leads, projects, taskAssignees, tasks, users } from '@/lib/db/schema'
import { sendEmail } from '@/lib/email/send'
import { serverEnv } from '@/lib/env.server'
import { todayCalendarDate } from '@/lib/updates/window'

import {
  buildDueDigestLists,
  formatDigestDate,
  greetingName,
  type DueDigestTask,
} from './due-digest-utils'

type DigestRow = DueDigestTask & {
  userId: string
  email: string
  fullName: string | null
  role: 'ADMIN' | 'SALES' | 'CLIENT'
  leadId: string | null
  /** The assignee is a member of the project, or it is their own board. */
  canWork: boolean
}

export type DueDigestResult = {
  today: string
  sent: number
  failed: number
}

/**
 * Who gets a task in their morning email:
 * - SALES users: every open task they're assigned on a project they can
 *   work (a member project or their own personal board).
 * - Admins: only tasks tied to a lead. Their client work has its own
 *   rhythm and would bury the sales reminders.
 */
function belongsInDigest(row: DigestRow): boolean {
  if (row.role === 'SALES') return row.canWork
  if (row.role === 'ADMIN') return row.leadId !== null
  return false
}

/** Loads every open, assigned task due today or earlier. */
async function loadDueRows(today: string): Promise<DigestRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      title: tasks.title,
      dueOn: tasks.dueOn,
      projectName: projects.name,
      leadId: leads.id,
      leadName: leads.contactName,
      canWork: sql<boolean>`(
        exists (
          select 1 from project_members pm
          where pm.project_id = ${projects.id}
            and pm.user_id = ${users.id}
            and pm.deleted_at is null
        )
        or (${projects.type} = 'PERSONAL' and ${projects.createdBy} = ${users.id})
      )`,
    })
    .from(tasks)
    .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(leads, and(eq(leads.id, tasks.leadId), isNull(leads.deletedAt)))
    .where(
      and(
        isNull(tasks.deletedAt),
        isNull(tasks.acceptedAt),
        ne(tasks.status, 'DONE'),
        lte(tasks.dueOn, today),
        isNull(taskAssignees.deletedAt),
        isNull(projects.deletedAt),
        isNull(users.deletedAt),
        isNull(users.disabledAt),
        inArray(users.role, ['ADMIN', 'SALES'])
      )
    )

  return rows
    .filter((row): row is typeof row & { dueOn: string } => row.dueOn !== null)
    .map(row => ({ ...row, canWork: Boolean(row.canWork) }))
}

function digestHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

/**
 * Sends each person one email listing their late and due-today tasks.
 * Nobody with nothing due gets mail. Safe to re-run the same day: each send
 * carries an idempotency key for the person, the date and the list.
 */
export async function sendTaskDueDigests(): Promise<DueDigestResult> {
  const today = todayCalendarDate()
  const rows = (await loadDueRows(today)).filter(belongsInDigest)

  const byUser = new Map<string, DigestRow[]>()
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? []
    list.push(row)
    byUser.set(row.userId, list)
  }

  const origin = new URL(serverEnv.GOOGLE_REDIRECT_URI).origin
  const dateLabel = formatDigestDate(today)
  let sent = 0
  let failed = 0

  for (const [userId, userRows] of byUser) {
    const first = userRows[0]
    const { late, dueToday } = buildDueDigestLists(userRows, today)
    if (!late.length && !dueToday.length) continue

    const email = taskDueDigestEmail({
      recipientName: greetingName(first.fullName, first.email),
      dateLabel,
      late,
      dueToday,
      tasksUrl: `${origin}/my/tasks/board`,
      replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    })

    try {
      await sendEmail({
        from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
        to: first.email,
        replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
        subject: email.subject,
        text: email.text,
        html: email.html,
        // Same person, day and list: a re-run is dropped. A list that changed
        // since the last run gets a new key, since Resend rejects a reused
        // key with a different body.
        idempotencyKey: `task-due-digest:${userId}:${today}:${digestHash(email.text)}`,
      })
      sent += 1
    } catch (error) {
      failed += 1
      console.error('Failed to send task due digest', { userId, error })
    }
  }

  return { today, sent, failed }
}

/** Placeholder digest for the email catalog. */
export function sampleTaskDueDigest(origin: string, replyTo: string) {
  const today = '2026-10-29'
  const { late, dueToday } = buildDueDigestLists(
    [
      {
        title: 'Send the proposal follow-up',
        dueOn: '2026-10-26',
        projectName: 'Sales',
        leadName: 'Jordan Sample',
      },
      {
        title: 'Book a discovery call',
        dueOn: '2026-10-28',
        projectName: 'Sales',
        leadName: 'Sample Co.',
      },
      {
        title: 'Draft the scope for the site rebuild',
        dueOn: today,
        projectName: 'Sales',
        leadName: 'Alex Example',
      },
    ],
    today
  )

  return taskDueDigestEmail({
    recipientName: 'Jordan',
    dateLabel: formatDigestDate(today),
    late,
    dueToday,
    tasksUrl: `${origin}/my/tasks/board`,
    replyTo,
  })
}

