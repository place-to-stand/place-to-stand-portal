import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { buildNotificationCatalog } from '@/lib/notifications/catalog'

import { NotificationsGallery } from '../_components/notifications-gallery'
import { helpCrumbs, helpTabsFor } from '../../_lib/tabs'

export const metadata: Metadata = {
  title: 'Notification templates | Help',
}

export default async function NotificationTemplatesPage() {
  const user = await requirePage('settings.templates')
  const entries = buildNotificationCatalog()

  return (
    <PageShell
      breadcrumbs={helpCrumbs('notifications')}
      tabs={helpTabsFor(user.role)}
      activeTab='notifications'
      count={{ label: 'templates', total: entries.length }}
    >
      <NotificationsGallery entries={entries} />
    </PageShell>
  )
}
