'use client'

import {
  NotificationActions,
  NotificationFilterToggle,
  NotificationList,
  useNotificationFeed,
} from '@/components/notifications/notification-feed'

import { WidgetCard } from './widget-card'

export function NotificationsWidget({ className }: { className?: string }) {
  const feed = useNotificationFeed()

  return (
    <WidgetCard
      id='notifications'
      title='My notifications'
      meta={feed.unread ? `${feed.unread} unread` : null}
      className={className}
      titleAddon={<NotificationFilterToggle feed={feed} />}
      action={<NotificationActions feed={feed} />}
    >
      <NotificationList feed={feed} />
    </WidgetCard>
  )
}
