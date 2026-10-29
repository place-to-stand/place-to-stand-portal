'use client'

/**
 * The notification stream shared by the home widget and the header bell:
 * one query (polled), optimistic read/unread/clear, and the list markup.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Circle, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { formatRelativeTime } from '@pts/ui/dates'
import { Tabs, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import type {
  NotificationFeed,
  NotificationFilter,
  NotificationItem,
} from '@/lib/notifications/in-app/types'
import { cn } from '@/lib/utils'

const QUERY_KEY = ['notifications'] as const
// Background refresh while the home page is open.
const POLL_MS = 60_000

type FeedAction = { action: 'read' | 'unread' | 'clear'; ids?: string[] }

async function fetchFeed(
  filter: NotificationFilter
): Promise<NotificationFeed> {
  const response = await fetch(`/api/notifications?filter=${filter}`)
  const payload = await response.json()
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? 'Unable to load notifications.')
  }
  return payload.data
}

async function postAction(body: FeedAction) {
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
function applyLocally(
  feed: NotificationFeed,
  { action, ids }: FeedAction,
  filter: NotificationFilter
): NotificationFeed {
  const hits = (item: NotificationItem) => !ids || ids.includes(item.id)
  const now = new Date().toISOString()
  let items = feed.items

  if (action === 'clear') {
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
  const unreadCount =
    action === 'unread'
      ? feed.unreadCount +
        feed.items.filter(item => hits(item) && item.readAt).length
      : Math.max(0, feed.unreadCount - (ids ? changedUnread : feed.unreadCount))

  return { items, unreadCount }
}

export function useNotificationFeed() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const key = [...QUERY_KEY, filter]

  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => fetchFeed(filter),
    refetchInterval: POLL_MS,
  })

  const mutation = useMutation({
    mutationFn: postAction,
    onMutate: async action => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous = queryClient.getQueryData<NotificationFeed>(key)
      if (previous) {
        queryClient.setQueryData(key, applyLocally(previous, action, filter))
      }
      return { previous }
    },
    onError: (_error, _action, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const items = data?.items ?? []
  const unread = data?.unreadCount ?? 0

  const openItem = (item: NotificationItem) => {
    if (!item.readAt) mutation.mutate({ action: 'read', ids: [item.id] })
    if (item.href) router.push(item.href, { scroll: false })
  }

  return {
    filter,
    setFilter,
    items,
    unread,
    isLoading,
    isError,
    mutation,
    openItem,
  }
}

export type NotificationFeedState = ReturnType<typeof useNotificationFeed>

/** All/Unread tabs, mark all read, clear all. */
/**
 * The feed's toolbar row: the All/Unread toggle on the left, and on the
 * right two matching text buttons, Mark all read and Clear all (confirmed).
 * The same row in the bell popover and the home widget.
 */
export function NotificationControls({
  feed,
  onConfirmOpenChange,
}: {
  feed: NotificationFeedState
  /** Lets the bell keep its popover open while the confirm is up. */
  onConfirmOpenChange?: (open: boolean) => void
}) {
  const { filter, setFilter, items, unread, mutation } = feed
  const [confirmOpen, setConfirmOpen] = useState(false)
  const setConfirm = (next: boolean) => {
    setConfirmOpen(next)
    onConfirmOpenChange?.(next)
  }
  return (
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <Tabs
        value={filter}
        onValueChange={value => setFilter(value as NotificationFilter)}
      >
        <TabsList className='h-7' aria-label='Show'>
          <TabsTrigger value='all' className='px-2 py-0.5 text-xs'>
            All
          </TabsTrigger>
          <TabsTrigger value='unread' className='px-2 py-0.5 text-xs'>
            Unread
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className='ml-auto flex items-center gap-1'>
        <Button
          type='button'
          variant='ghost'
          size='xs'
          disabled={!unread}
          onClick={() => mutation.mutate({ action: 'read' })}
        >
          Mark all read
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='xs'
          disabled={!items.length}
          onClick={() => setConfirm(true)}
        >
          Clear all
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title='Clear all notifications?'
        description='This removes every notification from your list. It can’t be undone.'
        confirmLabel='Clear all'
        confirmVariant='destructive'
        onConfirm={() => {
          mutation.mutate({ action: 'clear' })
          setConfirm(false)
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}

/** Loading, error, empty and the list itself. */
export function NotificationList({
  feed,
  className,
}: {
  feed: NotificationFeedState
  className?: string
}) {
  const { filter, items, isLoading, isError, mutation, openItem } = feed
  return (
    <>
      {isLoading ? (
        <p className='text-muted-foreground px-4 py-6 text-sm'>Loading…</p>
      ) : isError ? (
        <p className='text-destructive px-4 py-6 text-sm'>
          Couldn’t load notifications. They’ll retry shortly.
        </p>
      ) : items.length === 0 ? (
        <div className='p-4'>
          <EmptyState
            message={
              filter === 'unread'
                ? 'All caught up.'
                : 'No notifications. Assignments, comments on your tasks and due dates show up here.'
            }
          />
        </div>
      ) : (
        <ul
          className={cn('max-h-96 divide-y overflow-y-auto', className)}
          aria-live='polite'
        >
          {items.map(item => (
            <li key={item.id} className='group relative flex items-start'>
              <button
                type='button'
                data-notification-open
                onClick={() => openItem(item)}
                className='hover:bg-muted/50 focus-visible:bg-muted/50 flex min-w-0 flex-1 items-start gap-3 px-4 py-2.5 text-left outline-none'
              >
                <Circle
                  aria-label={item.readAt ? 'Read' : 'Unread'}
                  className={cn(
                    'mt-1.5 size-2 shrink-0',
                    item.readAt
                      ? 'text-transparent'
                      : 'fill-primary text-primary'
                  )}
                />
                <span className='min-w-0 flex-1'>
                  <span
                    className={cn(
                      'block truncate text-sm',
                      !item.readAt && 'font-semibold'
                    )}
                  >
                    {item.title}
                  </span>
                  {item.body ? (
                    <span className='text-muted-foreground line-clamp-2 block text-xs'>
                      {item.body}
                    </span>
                  ) : null}
                  <span className='text-muted-foreground block text-[11px]'>
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </span>
              </button>
              <div className='flex shrink-0 items-center gap-0.5 py-2 pr-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'>
                <Button
                  type='button'
                  variant='ghost'
                  size='xs'
                  onClick={() =>
                    mutation.mutate({
                      action: item.readAt ? 'unread' : 'read',
                      ids: [item.id],
                    })
                  }
                >
                  {item.readAt ? 'Mark unread' : 'Mark read'}
                </Button>
                <RowActionButton
                  type='button'
                  label='Clear notification'
                  icon={<X aria-hidden />}
                  onClick={() =>
                    mutation.mutate({ action: 'clear', ids: [item.id] })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
