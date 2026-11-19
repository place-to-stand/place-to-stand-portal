import type { Metadata } from 'next'
import { Bell } from 'lucide-react'

import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { IN_APP_NOTIFICATIONS } from '@/lib/notifications/in-app/catalog'
import {
  referenceCrumbs,
  referenceTabsFor,
} from '@/lib/navigation/reference-tabs'

export const metadata: Metadata = {
  title: 'Notifications | Reference',
}

/**
 * Reference → Notifications: every in-app notification, who gets it, what
 * sets it off and what doesn't. Read from `IN_APP_NOTIFICATIONS`; emails and
 * chat messages are under Templates.
 */
export default async function NotificationsReferencePage() {
  const user = await requirePage('settings.templates')
  const total = IN_APP_NOTIFICATIONS.reduce(
    (sum, group) => sum + group.entries.length,
    0
  )

  return (
    <PageShell
      breadcrumbs={referenceCrumbs('notifications')}
      tabs={referenceTabsFor(user.role)}
      activeTab='notifications'
      count={{ label: 'notifications', total }}
    >
      <div className='w-full space-y-6'>
        <p className='text-muted-foreground text-sm'>
          What shows up in the bell and on Home. Each one is about your work:
          something someone else did to it, or a task gone overdue. Archive
          keeps a notification under Archived until you restore it. Emails and
          chat messages are under Templates.
        </p>

        {IN_APP_NOTIFICATIONS.map(group => (
          <PagePanel
            key={group.title}
            aria-labelledby={`group-${group.title}`}
            flush
            className='overflow-hidden'
          >
            <div className='bg-muted/40 border-b px-4 py-2.5'>
              <h2 id={`group-${group.title}`} className='text-sm font-semibold'>
                {group.title}
              </h2>
            </div>
            <ul className='divide-y'>
              {group.entries.map(entry => (
                <li
                  key={entry.type}
                  className='grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]'
                >
                  <div className='flex min-w-0 flex-col gap-2'>
                    <h3 className='text-sm font-semibold'>{entry.name}</h3>
                    {/* The row as the bell draws it. */}
                    <div className='bg-muted/40 flex items-start gap-3 rounded-md border px-3 py-2.5'>
                      <Bell
                        aria-hidden
                        className='text-muted-foreground mt-0.5 size-3.5 shrink-0'
                      />
                      <span className='min-w-0'>
                        <span className='block text-sm font-semibold'>
                          {entry.sample.title}
                        </span>
                        {entry.sample.body ? (
                          <span className='text-muted-foreground block text-xs'>
                            {entry.sample.body}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                  <dl className='grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm'>
                    <dt className='text-muted-foreground'>Who gets it</dt>
                    <dd>{entry.recipients}</dd>
                    <dt className='text-muted-foreground'>Sent when</dt>
                    <dd>{entry.when}</dd>
                    <dt className='text-muted-foreground'>Not sent</dt>
                    <dd>{entry.notWhen}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </PagePanel>
        ))}
      </div>
    </PageShell>
  )
}
