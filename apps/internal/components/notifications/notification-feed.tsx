'use client'

/**
 * The notification stream shared by the home widget and the header bell:
 * one query (polled), optimistic read/unread/clear, and the list markup —
 * unread first, then an "Earlier" section of read items.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Circle, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { formatRelativeTime } from '@pts/ui/dates'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import type {
  NotificationFeed,
  NotificationItem,
} from '@/lib/notifications/in-app/types'
import { cn } from '@/lib/utils'

const QUERY_KEY = ['notifications'] as const
// Background refresh while the home page is open.
const POLL_MS = 60_000

type FeedAction = {
  action: 'read' | 'unread' | 'clear' | 'clear-read'
  ids?: string[]
}

async function fetchFeed(): Promise<NotificationFeed> {
  const response = await fetch('/api/notifications')
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
  { action, ids }: FeedAction
): NotificationFeed {
  if (action === 'clear-read') {
    return { ...feed, items: feed.items.filter(item => !item.readAt) }
  }

  const hits = (item: NotificationItem) => !ids || ids.includes(item.id)
  const now = new Date().toISOString()
  const items =
    action === 'clear'
      ? feed.items.filter(item => !hits(item))
      : feed.items.map(item =>
          hits(item)
            ? {
                ...item,
                readAt: action === 'read' ? (item.readAt ?? now) : null,
              }
            : item
        )

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
  const [confirmingClearRead, setConfirmingClearRead] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFeed,
    refetchInterval: POLL_MS,
  })

  const mutation = useMutation({
    mutationFn: postAction,
    onMutate: async action => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous = queryClient.getQueryData<NotificationFeed>(QUERY_KEY)
      if (previous) {
        queryClient.setQueryData(QUERY_KEY, applyLocally(previous, action))
      }
      return { previous }
    },
    onError: (_error, _action, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous)
      }
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
    items,
    unread,
    isLoading,
    isError,
    mutation,
    openItem,
    /** "Clear read" asks first; the bell keeps its popover open meanwhile. */
    confirmingClearRead,
    setConfirmingClearRead,
  }
}

export type NotificationFeedState = ReturnType<typeof useNotificationFeed>

/** Header action: "Mark all read", only while something is unread. */
export function NotificationControls({
  feed,
}: {
  feed: NotificationFeedState
}) {
  if (!feed.unread) return null
  return (
    <Button
      type='button'
      variant='ghost'
      size='xs'
      onClick={() => feed.mutation.mutate({ action: 'read' })}
    >
      Mark all read
    </Button>
  )
}

function NotificationRow({
  item,
  feed,
}: {
  item: NotificationItem
  feed: NotificationFeedState
}) {
  const { mutation, openItem } = feed
  const read = Boolean(item.readAt)
  return (
    <li className='group relative flex items-start'>
      <button
        type='button'
        data-notification-open
        onClick={() => openItem(item)}
        className='hover:bg-muted/50 focus-visible:bg-muted/50 flex min-w-0 flex-1 items-start gap-3 px-4 py-2.5 text-left outline-none'
      >
        <Circle
          aria-label={read ? 'Read' : 'Unread'}
          className={cn(
            'mt-1.5 size-2 shrink-0',
            read ? 'text-transparent' : 'fill-primary text-primary'
          )}
        />
        <span className='min-w-0 flex-1'>
          <span
            className={cn(
              'block truncate text-sm',
              read ? 'text-muted-foreground' : 'font-semibold'
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
              action: read ? 'unread' : 'read',
              ids: [item.id],
            })
          }
        >
          {read ? 'Mark unread' : 'Mark read'}
        </Button>
        <RowActionButton
          type='button'
          label='Clear notification'
          icon={<X aria-hidden />}
          onClick={() => mutation.mutate({ action: 'clear', ids: [item.id] })}
        />
      </div>
    </li>
  )
}

/** Loading, error, empty, then unread items and the "Earlier" (read) section. */
export function NotificationList({
  feed,
  className,
}: {
  feed: NotificationFeedState
  className?: string
}) {
  const {
    items,
    isLoading,
    isError,
    mutation,
    confirmingClearRead,
    setConfirmingClearRead,
  } = feed

  if (isLoading) {
    return <p className='text-muted-foreground px-4 py-6 text-sm'>Loading…</p>
  }
  if (isError) {
    return (
      <p className='text-destructive px-4 py-6 text-sm'>
        Couldn’t load notifications. They’ll retry shortly.
      </p>
    )
  }
  if (items.length === 0) {
    return (
      <div className='p-4'>
        <EmptyState message='You’re all caught up.' />
      </div>
    )
  }

  const unreadItems = items.filter(item => !item.readAt)
  const readItems = items.filter(item => item.readAt)

  return (
    <div
      className={cn('max-h-96 overflow-y-auto', className)}
      aria-live='polite'
    >
      {unreadItems.length ? (
        <ul className='divide-y'>
          {unreadItems.map(item => (
            <NotificationRow key={item.id} item={item} feed={feed} />
          ))}
        </ul>
      ) : null}
      {readItems.length ? (
        <section aria-label='Earlier' className='border-t first:border-t-0'>
          <h3 className='bg-muted/40 text-muted-foreground px-4 py-1.5 text-[11px] font-semibold tracking-wide uppercase'>
            Earlier
          </h3>
          <ul className='divide-y'>
            {readItems.map(item => (
              <NotificationRow key={item.id} item={item} feed={feed} />
            ))}
          </ul>
          <div className='flex justify-end border-t px-2 py-1.5'>
            <Button
              type='button'
              variant='ghost'
              size='xs'
              onClick={() => setConfirmingClearRead(true)}
            >
              Clear read
            </Button>
          </div>
        </section>
      ) : null}
      <ConfirmDialog
        open={confirmingClearRead}
        title='Clear read notifications?'
        description='Everything under Earlier is removed from your list. Unread notifications stay.'
        confirmLabel='Clear read'
        confirmVariant='destructive'
        onConfirm={() => {
          setConfirmingClearRead(false)
          mutation.mutate({ action: 'clear-read' })
        }}
        onCancel={() => setConfirmingClearRead(false)}
      />
    </div>
  )
}
