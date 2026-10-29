'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Circle, X } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { formatRelativeTime } from '@pts/ui/dates'
import { Tabs, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import type {
  NotificationFeed,
  NotificationFilter,
  NotificationItem,
} from '@/lib/notifications/in-app/types'
import { cn } from '@/lib/utils'

import { WidgetCard } from './widget-card'

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

export function NotificationsWidget({ className }: { className?: string }) {
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

  return (
    <WidgetCard
      id='notifications'
      title='Notifications'
      meta={unread ? `${unread} unread` : null}
      className={className}
      action={
        <div className='flex items-center gap-1'>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label='Mark all as read'
                disabled={!unread}
                onClick={() => mutation.mutate({ action: 'read' })}
              >
                <CheckCheck aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark all as read</TooltipContent>
          </Tooltip>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            disabled={!items.length}
            onClick={() => mutation.mutate({ action: 'clear' })}
          >
            Clear all
          </Button>
        </div>
      }
    >
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
        <ul className='max-h-96 divide-y overflow-y-auto' aria-live='polite'>
          {items.map(item => (
            <li key={item.id} className='group relative flex items-start'>
              <button
                type='button'
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
    </WidgetCard>
  )
}
