import { personNameSql } from '@pts/db/names'
import 'server-only'

import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  isNotNull,
  lt,
  ne,
  sql,
} from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { notifications, taskAssignees, tasks, users } from '@/lib/db/schema'
import {
  listWorkableProjectIds,
  workableTasksFilter,
} from '@/lib/projects/access'
import { myTaskHref } from '@/lib/sheets/hrefs'
import { companyCalendarDate } from '@pts/ui/dates'

import { getBusinessIdentity } from '@/lib/business/identity'

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
 * cron: one "overdue" per task and due date, for open tasks assigned to the
 * user that they can work. There is no "due today": it only repeated a date
 * the person could already see (often one they had just set themselves).
 */
async function syncDueTaskNotifications(user: AppUser) {
  const today = companyCalendarDate()
  const workable = await listWorkableProjectIds(user)

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
        lt(tasks.dueOn, today),
        workableTasksFilter(user, workable)
      )
    )

  await createNotifications(
    rows.flatMap(row => {
      if (!row.dueOn) return []
      return [
        {
          userId: user.id,
          type: 'task_overdue',
          title: `Overdue: ${row.title}`,
          body: `Was due ${row.dueOn}`,
          href: myTaskHref(row.id),
          dedupeKey: `task-overdue:${row.id}:${row.dueOn}`,
        } satisfies NewNotification,
      ]
    })
  )
}

const live = (userId: string) =>
  and(eq(notifications.userId, userId), isNull(notifications.clearedAt))

/**
 * The due-date sync writes, and the feed is polled from every open tab, so
 * each server instance runs it at most once per user every 15 minutes (and
 * again as soon as the company date changes).
 */
const DUE_SYNC_INTERVAL_MS = 15 * 60_000
const lastDueSync = new Map<string, { at: number; date: string }>()

async function syncDueTaskNotificationsThrottled(user: AppUser) {
  // The feed is a route handler, which skips the root layout: load the
  // business time zone before reading today's date.
  await getBusinessIdentity()
  const now = Date.now()
  const date = companyCalendarDate()
  const last = lastDueSync.get(user.id)
  if (last && last.date === date && now - last.at < DUE_SYNC_INTERVAL_MS) {
    return
  }
  await syncDueTaskNotifications(user)
  lastDueSync.set(user.id, { at: now, date })
}

/**
 * A page boundary: the last row's sort time and id. Paging by position would
 * skip or repeat rows as new notifications arrive; this never does.
 */
export function encodeFeedCursor(sortAt: string, id: string) {
  return `${sortAt}_${id}`
}

function decodeFeedCursor(cursor: string) {
  const split = cursor.lastIndexOf('_')
  return { sortAt: cursor.slice(0, split), id: cursor.slice(split + 1) }
}

export async function fetchNotificationFeed(
  user: AppUser,
  filter: NotificationFilter,
  before?: string
): Promise<NotificationFeed> {
  // Only the first page syncs; older pages are history.
  if (!before) await syncDueTaskNotificationsThrottled(user)

  // Archived sorts by when it was archived; All and Unread by when it came.
  const sortColumn =
    filter === 'archived' ? notifications.clearedAt : notifications.createdAt
  const cursor = before ? decodeFeedCursor(before) : null

  const where =
    filter === 'archived'
      ? and(
          eq(notifications.userId, user.id),
          isNotNull(notifications.clearedAt)
        )
      : filter === 'unread'
        ? and(live(user.id), isNull(notifications.readAt))
        : live(user.id)
  const olderThanCursor = cursor
    ? sql`(${sortColumn}, ${notifications.id}) < (${cursor.sortAt}::timestamptz, ${cursor.id}::uuid)`
    : undefined

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
        sortAt: sql<string>`${sortColumn}::text`,
        actorName: sql<
          string | null
        >`coalesce(${personNameSql}, ${users.email})`,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(and(where, olderThanCursor))
      .orderBy(desc(sortColumn), desc(notifications.id))
      // One extra row says whether there's another page.
      .limit(FEED_LIMIT + 1),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(live(user.id), isNull(notifications.readAt))),
  ])

  const page = rows.slice(0, FEED_LIMIT)
  const last = page.at(-1)
  return {
    items: page.map(row => ({
      id: row.id,
      type: row.type as NotificationItem['type'],
      title: row.title,
      body: row.body,
      href: row.href,
      actorName: row.actorName,
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
    unreadCount: Number(unread?.value ?? 0),
    nextCursor:
      rows.length > FEED_LIMIT && last
        ? encodeFeedCursor(last.sortAt, last.id)
        : null,
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

/**
 * Archives notifications: out of All and Unread, kept under Archived and
 * restorable. Archiving also marks them read. (The column is `cleared_at`.)
 */
export async function archiveNotifications(userId: string, ids?: string[]) {
  await db
    .update(notifications)
    .set({
      clearedAt: sql`timezone('utc'::text, now())`,
      readAt: sql`coalesce(${notifications.readAt}, timezone('utc'::text, now()))`,
    })
    .where(and(live(userId), ids ? inArray(notifications.id, ids) : undefined))
}

/** Brings archived notifications back to All, as read (archive marks them read). */
export async function restoreNotifications(userId: string, ids: string[]) {
  await db
    .update(notifications)
    .set({ clearedAt: null })
    .where(
      and(
        eq(notifications.userId, userId),
        isNotNull(notifications.clearedAt),
        inArray(notifications.id, ids)
      )
    )
}

/** How long an archived notification is kept before the weekly prune. */
export const ARCHIVED_NOTIFICATION_DAYS = 90
const PRUNE_BATCH = 1000

/**
 * Deletes notifications archived more than 90 days ago, in batches. Unread
 * and unarchived ones are never touched. Returns how many went.
 */
export async function pruneArchivedNotifications(): Promise<number> {
  let deletedCount = 0
  for (;;) {
    const batch = db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        lt(
          notifications.clearedAt,
          sql`now() - make_interval(days => ${ARCHIVED_NOTIFICATION_DAYS})`
        )
      )
      .limit(PRUNE_BATCH)
    const deleted = await db
      .delete(notifications)
      .where(inArray(notifications.id, batch))
      .returning({ id: notifications.id })
    deletedCount += deleted.length
    if (deleted.length < PRUNE_BATCH) return deletedCount
  }
}
