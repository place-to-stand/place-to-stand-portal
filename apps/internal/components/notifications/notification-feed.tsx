'use client'

/**
 * The notification stream shared by the home widget and the header bell:
 * one query (polled), optimistic read/unread/archive/restore, and the list markup.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { Archive, ArchiveRestore, Circle } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { formatRelativeTime } from '@pts/ui/dates'
import { Tabs, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { useToast } from '@/components/ui/use-toast'
import type {
  NotificationFeed,
  NotificationFilter,
  NotificationItem,
} from '@/lib/notifications/in-app/types'

import {
  applyToPages,
  FAILURE_TITLES,
  fetchFeed,
  postAction,
} from './notification-feed-utils'
import { cn } from '@/lib/utils'

const QUERY_KEY = ['notifications'] as const

// Background refresh on every page, since the header bell is on every page
// (paused in hidden tabs).
const POLL_MS = 2 * 60_000

export function useNotificationFeed() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const key = [...QUERY_KEY, filter]

  // Pages of 50, newest first; "Show more" asks for the rows older than the
  // last one shown. A poll refreshes every loaded page.
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchFeed(filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    refetchInterval: POLL_MS,
  })

  const mutation = useMutation({
    mutationFn: postAction,
    onMutate: async action => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous =
        queryClient.getQueryData<InfiniteData<NotificationFeed, string | null>>(
          key
        )
      if (previous) {
        queryClient.setQueryData(key, applyToPages(previous, action, filter))
      }
      return { previous }
    },
    onError: (error, action, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast({
        title: FAILURE_TITLES[action.action],
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const items = data?.pages.flatMap(page => page.items) ?? []
  const unread = data?.pages[0]?.unreadCount ?? 0

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
    hasMore: Boolean(hasNextPage),
    loadingMore: isFetchingNextPage,
    showMore: () => void fetchNextPage(),
  }
}

type NotificationFeedState = ReturnType<typeof useNotificationFeed>

/** The All / Unread / Archived toggle, beside the "Notifications" title. */
export function NotificationFilterToggle({
  feed,
}: {
  feed: NotificationFeedState
}) {
  const { filter, setFilter } = feed
  return (
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
        <TabsTrigger value='archived' className='px-2 py-0.5 text-xs'>
          Archived
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

/**
 * Mark all read and Archive all, as matching text buttons in a footer row
 * under the list, in the bell and the home widget (the title row holds the
 * title and tabs). Archive is undone from the Archived tab, so it needs no
 * confirm. Archived has nothing to act on in bulk, so it has no footer.
 */
export function NotificationActions({ feed }: { feed: NotificationFeedState }) {
  const { filter, items, unread, mutation } = feed
  if (filter === 'archived') return null
  return (
    <footer className='flex items-center justify-end gap-1 border-t px-4 py-1.5'>
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
        onClick={() =>
          mutation.mutate({
            action: 'archive',
            // Only what's on screen, so one that arrived since the last
            // poll isn't archived unseen.
            ids: items.map(item => item.id),
          })
        }
      >
        Archive all
      </Button>
    </footer>
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
                : filter === 'archived'
                  ? 'Nothing archived. Archived notifications stay here for 90 days.'
                  : 'No notifications. When someone assigns you work, comments on your tasks or moves your leads, it shows up here.'
            }
          />
        </div>
      ) : (
        <ul
          className={cn('max-h-96 divide-y overflow-y-auto', className)}
          aria-live='polite'
        >
          {items.map(item => (
            // The whole row lights up and opens the notification (the button's
            // ::after covers it); only the row's actions, above it, don't.
            <li
              key={item.id}
              className='group hover:bg-muted/50 has-[[data-notification-open]:focus-visible]:bg-muted/50 relative flex items-start'
            >
              <button
                type='button'
                data-notification-open
                onClick={() => openItem(item)}
                className='flex min-w-0 flex-1 items-start gap-3 px-4 py-2.5 text-left outline-none after:absolute after:inset-0'
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
                  <span className='text-muted-foreground block text-xs'>
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </span>
              </button>
              <div className='pointer-events-none relative flex shrink-0 items-center gap-0.5 py-2 pr-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [&>*]:pointer-events-auto'>
                {filter === 'archived' ? (
                  <RowActionButton
                    type='button'
                    label='Restore notification'
                    icon={<ArchiveRestore aria-hidden />}
                    onClick={() =>
                      mutation.mutate({ action: 'restore', ids: [item.id] })
                    }
                  />
                ) : (
                  <>
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
                      label='Archive notification'
                      icon={<Archive aria-hidden />}
                      onClick={() =>
                        mutation.mutate({ action: 'archive', ids: [item.id] })
                      }
                    />
                  </>
                )}
              </div>
            </li>
          ))}
          {feed.hasMore && items.length > 0 ? (
            <li className='flex justify-center px-4 py-2'>
              <Button
                type='button'
                variant='ghost'
                size='xs'
                disabled={feed.loadingMore}
                onClick={feed.showMore}
              >
                {feed.loadingMore ? 'Loading…' : 'Show more'}
              </Button>
            </li>
          ) : null}
        </ul>
      )}
    </>
  )
}
