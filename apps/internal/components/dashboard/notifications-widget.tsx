'use client'

import {
  NotificationControls,
  NotificationList,
  useNotificationFeed,
} from '@/components/notifications/notification-feed'

import { WidgetCard } from './widget-card'

export function NotificationsWidget({ className }: { className?: string }) {
  const feed = useNotificationFeed()

  return (
    <WidgetCard
      id='notifications'
      title='Notifications'
      meta={feed.unread ? `${feed.unread} unread` : null}
      className={className}
    >
      <div className='space-y-2'>
        <NotificationControls feed={feed} />
        <NotificationList feed={feed} />
      </div>
    </WidgetCard>
  )
}
