/**
 * In-app notification kinds. Stored as plain text, so adding one is a code
 * change only. Client-safe.
 */
export const NOTIFICATION_TYPES = [
  'task_assigned',
  'task_comment',
  'task_due_today',
  'task_overdue',
  'task_status',
  'lead_assigned',
  'lead_update',
  'lead_stage',
  'connection_reauth',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  body: string | null
  href: string | null
  actorName: string | null
  readAt: string | null
  createdAt: string
}

export type NotificationFeed = {
  items: NotificationItem[]
  unreadCount: number
  /** Pass as `before` for the next (older) page; null on the last page. */
  nextCursor: string | null
}

export type NotificationFilter = 'all' | 'unread' | 'archived'
