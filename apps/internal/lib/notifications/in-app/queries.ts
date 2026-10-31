import { personNameSql } from '@pts/db/names'
import 'server-only'

import { and, count, desc, eq, inArray, isNull, lte, ne, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { notifications, taskAssignees, tasks, users } from '@/lib/db/schema'
import { listWorkableProjectIds } from '@/lib/projects/access'
import { myTaskHref } from '@/lib/sheets/hrefs'
import { todayCalendarDate } from '@/lib/updates/window'

import type {
  NotificationFeed,
  NotificationFilter,
  NotificationItem,
  NotificationType,
} from './types'

const FEED_LIMIT = 50

export type NewNotification = {
  userId: string
  type: NotificationType
  title: string
  body?: string | null
  href?: string | null
  actorId?: string | null
  dedupeKey?: string | null
}

/**
 * Inserts notifications, skipping any whose `dedupeKey` the recipient
 * already has. Never notifies the actor about their own action.
 */
export async function createNotifications(rows: NewNotification[]) {
  const values = rows.filter(row => !row.actorId || row.actorId !== row.userId)
  if (!values.length) return

  await db
    .insert(notifications)
    .values(
      values.map(row => ({
        userId: row.userId,
        type: row.type,
        title: row.title,
        body: row.body ?? null,
        href: row.href ?? null,
        actorId: row.actorId ?? null,
        dedupeKey: row.dedupeKey ?? null,
      }))
    )
    .onConflictDoNothing({
      target: [notifications.userId, notifications.dedupeKey],
      where: sql`dedupe_key IS NOT NULL`,
    })
}

/**
 * Due-date notifications are made when the feed is read rather than by a
 * cron: one "due today" and one "overdue" per task and due date, for open
 * tasks assigned to the user on projects they can work.
 */
async function syncDueTaskNotifications(user: AppUser) {
  const today = todayCalendarDate()
  const workable = await listWorkableProjectIds(user)
  if (workable !== null && workable.length === 0) return

  const rows = await db
    .select({ id: tasks.id, title: tasks.title, dueOn: tasks.dueOn })
    .from(tasks)
    .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .where(
      and(
        eq(taskAssignees.userId, user.id),
        isNull(taskAssignees.deletedAt),
        isNull(tasks.deletedAt),
        isNull(tasks.acceptedAt),
        ne(tasks.status, 'DONE'),
        lte(tasks.dueOn, today),
        workable === null ? undefined : inArray(tasks.projectId, workable)
      )
    )

  await createNotifications(
    rows.flatMap(row => {
      if (!row.dueOn) return []
      const overdue = row.dueOn < today
      return [
        {
          userId: user.id,
          type: overdue ? 'task_overdue' : 'task_due_today',
          title: overdue ? `Overdue: ${row.title}` : `Due today: ${row.title}`,
          body: overdue ? `Was due ${row.dueOn}` : null,
          href: myTaskHref(row.id),
          dedupeKey: `${overdue ? 'task-overdue' : 'task-due'}:${row.id}:${row.dueOn}`,
        } satisfies NewNotification,
      ]
    })
  )
}

const live = (userId: string) =>
  and(eq(notifications.userId, userId), isNull(notifications.clearedAt))

export async function fetchNotificationFeed(
  user: AppUser,
  filter: NotificationFilter
): Promise<NotificationFeed> {
  await syncDueTaskNotifications(user)

  const where =
    filter === 'unread'
      ? and(live(user.id), isNull(notifications.readAt))
      : live(user.id)

  const [rows, [unread]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorName: sql<string | null>`coalesce(${personNameSql}, ${users.email})`,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(FEED_LIMIT),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(live(user.id), isNull(notifications.readAt))),
  ])

  return {
    items: rows.map(row => ({ ...row, type: row.type as NotificationItem['type'] })),
    unreadCount: Number(unread?.value ?? 0),
  }
}

/** `ids` limits the change to those rows; omitted means all of the user's. */
export async function markNotificationsRead(userId: string, ids?: string[]) {
  await db
    .update(notifications)
    .set({ readAt: sql`timezone('utc'::text, now())` })
    .where(
      and(
        live(userId),
        isNull(notifications.readAt),
        ids ? inArray(notifications.id, ids) : undefined
      )
    )
}

export async function markNotificationsUnread(userId: string, ids: string[]) {
  await db
    .update(notifications)
    .set({ readAt: null })
    .where(and(live(userId), inArray(notifications.id, ids)))
}

export async function clearNotifications(userId: string, ids?: string[]) {
  await db
    .update(notifications)
    .set({
      clearedAt: sql`timezone('utc'::text, now())`,
      readAt: sql`coalesce(${notifications.readAt}, timezone('utc'::text, now()))`,
    })
    .where(and(live(userId), ids ? inArray(notifications.id, ids) : undefined))
}
