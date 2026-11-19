import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'

import { PageShell } from '@/components/layout/page-shell'
import { buildNotificationCatalog } from '@/lib/notifications/catalog'

import { NotificationsGallery } from '../_components/notifications-gallery'

import {
  referenceCrumbs,
  referenceTabsFor,
} from '@/lib/navigation/reference-tabs'

export const metadata: Metadata = {
  title: 'Chat message templates | Reference',
}

export default async function ChatTemplatesPage() {
  const user = await requirePage('settings.templates')
  const entries = buildNotificationCatalog()

  return (
    <PageShell
      breadcrumbs={referenceCrumbs('chat')}
      tabs={referenceTabsFor(user.role)}
      activeTab='chat'
      count={{ label: 'templates', total: entries.length }}
    >
      <NotificationsGallery entries={entries} />
    </PageShell>
  )
}
