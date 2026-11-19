/**
 * The notification feed's requests and its optimistic update, kept apart
 * from the markup in `notification-feed.tsx`.
 */

import type { InfiniteData } from '@tanstack/react-query'

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
  filter: NotificationFilter,
  before: string | null
): Promise<NotificationFeed> {
  const params = new URLSearchParams({ filter })
  if (before) params.set('before', before)
  const response = await fetch(`/api/notifications?${params}`)
  const payload = await response.json()
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? 'Unable to load notifications.')
  }
  return payload.data
}

/** The API takes at most this many ids per call. */
const MAX_IDS = 200

/** Sends an action, splitting a long id list into calls the API accepts. */
export async function postAction(body: FeedAction) {
  if (!body.ids || body.ids.length <= MAX_IDS) return postOne(body)
  for (let start = 0; start < body.ids.length; start += MAX_IDS) {
    await postOne({ ...body, ids: body.ids.slice(start, start + MAX_IDS) })
  }
}

async function postOne(body: FeedAction) {
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
  // Archived rows are always read, so restoring one leaves the count alone.
  const unreadCount =
    action === 'restore'
      ? feed.unreadCount
      : action === 'unread'
        ? feed.unreadCount +
          feed.items.filter(item => hits(item) && item.readAt).length
        : Math.max(
            0,
            feed.unreadCount - (ids ? changedUnread : feed.unreadCount)
          )

  return { ...feed, items, unreadCount }
}

/**
 * `applyLocally` across every loaded page: the counts come from all of them
 * together, then each page keeps its own (changed) rows.
 */
export function applyToPages(
  data: InfiniteData<NotificationFeed, string | null>,
  action: FeedAction,
  filter: NotificationFilter
): InfiniteData<NotificationFeed, string | null> {
  const first = data.pages[0]
  if (!first) return data
  const merged = applyLocally(
    {
      items: data.pages.flatMap(page => page.items),
      unreadCount: first.unreadCount,
      nextCursor: null,
    },
    action,
    filter
  )
  const byId = new Map(merged.items.map(item => [item.id, item]))
  return {
    ...data,
    pages: data.pages.map(page => ({
      ...page,
      unreadCount: merged.unreadCount,
      items: page.items.flatMap(item => {
        const next = byId.get(item.id)
        return next ? [next] : []
      }),
    })),
  }
}
