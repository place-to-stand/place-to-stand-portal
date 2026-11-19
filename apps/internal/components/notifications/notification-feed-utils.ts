/**
 * The notification feed's requests and its optimistic update, kept apart
 * from the markup in `notification-feed.tsx`.
 */

import type {
  NotificationFeed,
  NotificationFilter,
  NotificationItem,
} from '@/lib/notifications/in-app/types'

export const FAILURE_TITLES: Record<FeedAction['action'], string> = {
  read: 'Unable to mark notifications read',
  unread: 'Unable to mark notifications unread',
  archive: 'Unable to archive notifications',
  restore: 'Unable to restore notifications',
}

export type FeedAction = {
  action: 'read' | 'unread' | 'archive' | 'restore'
  ids?: string[]
}

export async function fetchFeed(
  filter: NotificationFilter
): Promise<NotificationFeed> {
  const response = await fetch(`/api/notifications?filter=${filter}`)
  const payload = await response.json()
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? 'Unable to load notifications.')
  }
  return payload.data
}

export async function postAction(body: FeedAction) {
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? 'Unable to update notifications.')
  }
}

/** Applies an action to the cached feed so the UI updates before the server answers. */
export function applyLocally(
  feed: NotificationFeed,
  { action, ids }: FeedAction,
  filter: NotificationFilter
): NotificationFeed {
  const hits = (item: NotificationItem) => !ids || ids.includes(item.id)
  const now = new Date().toISOString()
  let items = feed.items

  if (action === 'archive' || action === 'restore') {
    // Either way the row leaves the tab it's on.
    items = items.filter(item => !hits(item))
  } else {
    items = items.map(item =>
      hits(item)
        ? { ...item, readAt: action === 'read' ? (item.readAt ?? now) : null }
        : item
    )
    if (filter === 'unread' && action === 'read') {
      items = items.filter(item => !item.readAt)
    }
  }

  const changedUnread = feed.items.filter(
    item => hits(item) && !item.readAt
  ).length
  const restoredUnread =
    action === 'restore'
      ? feed.items.filter(item => hits(item) && !item.readAt).length
      : 0
  const unreadCount =
    action === 'restore'
      ? feed.unreadCount + restoredUnread
      : action === 'unread'
        ? feed.unreadCount +
          feed.items.filter(item => hits(item) && item.readAt).length
        : Math.max(
            0,
            feed.unreadCount - (ids ? changedUnread : feed.unreadCount)
          )

  return { items, unreadCount }
}
