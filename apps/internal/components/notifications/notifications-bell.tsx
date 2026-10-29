'use client'

import { useRef, useState } from 'react'
import { Bell } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'

import {
  NotificationControls,
  NotificationList,
  useNotificationFeed,
} from './notification-feed'

/**
 * The header's notifications button, on every page: unread count badge and a
 * popover with the same stream as the home widget. Opening an item closes
 * the popover.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  // The Clear all confirm takes focus; don't let that close the popover.
  const confirmOpenRef = useRef(false)
  const feed = useNotificationFeed()
  const count = feed.unread
  const label = count ? `Notifications, ${count} unread` : 'Notifications'

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (!next && confirmOpenRef.current) return
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label={label}
          className='relative'
        >
          <Bell aria-hidden />
          {count ? (
            <span
              aria-hidden
              className='bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums'
            >
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        className='w-[min(26rem,calc(100vw-1.5rem))] overflow-hidden p-0'
      >
        <div className='space-y-2 border-b px-4 py-2.5'>
          <h2 className='text-sm font-semibold'>Notifications</h2>
          <NotificationControls
            feed={feed}
            onConfirmOpenChange={next => {
              confirmOpenRef.current = next
            }}
          />
        </div>
        <div
          onClickCapture={event => {
            // Opening a notification navigates; close the popover with it.
            if (
              (event.target as HTMLElement).closest('[data-notification-open]')
            ) {
              setOpen(false)
            }
          }}
        >
          <NotificationList feed={feed} className='max-h-[60vh]' />
        </div>
      </PopoverContent>
    </Popover>
  )
}
