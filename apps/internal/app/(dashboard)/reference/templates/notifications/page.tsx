import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { buildNotificationCatalog } from '@/lib/notifications/catalog'

import { NotificationsGallery } from '../_components/notifications-gallery'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

import { TEMPLATES_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Notification templates | Reference',
}

export default async function NotificationTemplatesPage() {
  await requirePage('settings.templates')
  const entries = buildNotificationCatalog()

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/reference/templates/emails')}
      tabs={TEMPLATES_TABS}
      activeTab='notifications'
      count={{ label: 'templates', total: entries.length }}
    >
      <NotificationsGallery entries={entries} />
    </PageShell>
  )
}
