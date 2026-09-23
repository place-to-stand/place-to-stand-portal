import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { buildNotificationCatalog } from '@/lib/notifications/catalog'

import { NotificationsGallery } from '../_components/notifications-gallery'
import { TEMPLATES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Templates | Settings',
}

export default function NotificationTemplatesPage() {
  const entries = buildNotificationCatalog()

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/settings/templates/emails')}
      tabs={TEMPLATES_TABS}
      activeTab='notifications'
      count={{ label: 'templates', total: entries.length }}
    >
      <NotificationsGallery entries={entries} />
    </PageShell>
  )
}
