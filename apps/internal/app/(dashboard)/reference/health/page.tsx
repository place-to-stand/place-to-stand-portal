import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import { serverEnv } from '@/lib/env.server'
import {
  countStaleUnreadNotifications,
  listConnectionHealth,
  readEmailQueueHealth,
} from '@/lib/health/queries'
import { readJobRuns, readStripeHealth } from '@/lib/health/runs'
import { listScheduledJobs } from '@/lib/health/scheduled-jobs'
import {
  referenceCrumbs,
  referenceTabsFor,
} from '@/lib/navigation/reference-tabs'

import { ConnectionsPanel } from './_components/connections-panel'
import { HealthPanel, Stat } from './_components/health-parts'
import { JobsPanel } from './_components/jobs-panel'
import { StripePanel } from './_components/stripe-panel'

export const metadata: Metadata = {
  title: 'System health | Reference',
}

export const dynamic = 'force-dynamic'

/** The company-wide keys the portal can't work without, set or not. */
function companyKeys() {
  return [
    {
      name: 'Stripe',
      set: Boolean(serverEnv.STRIPE_WEBHOOK_SECRET),
      does: 'Hears about invoice payments. Without it, paid invoices stay unpaid here.',
    },
    {
      name: 'Mercury',
      set: Boolean(serverEnv.MERCURY_API_TOKEN),
      does: 'Reads the month-end bank balance for the profit share.',
    },
  ]
}

/**
 * Reference → System health: whether the work the portal does on its own is
 * keeping up: scheduled jobs, Stripe payments, connected accounts and the
 * website form email queue.
 */
export default async function SystemHealthPage() {
  const user = await requirePage('settings.health')
  const jobs = listScheduledJobs()
  const [queue, staleUnread, runs, stripe, connections] = await Promise.all([
    readEmailQueueHealth(),
    countStaleUnreadNotifications(),
    readJobRuns(jobs.map(job => job.path)),
    readStripeHealth(),
    listConnectionHealth(),
  ])
  const now = new Date()
  const queueHealthy = queue.stuck === 0 && queue.gaveUp === 0

  return (
    <PageShell
      breadcrumbs={referenceCrumbs('health')}
      tabs={referenceTabsFor(user.role)}
      activeTab='health'
    >
      <div className='w-full space-y-6'>
        <p className='text-muted-foreground text-sm'>
          Whether the work the portal does on its own is keeping up. Anything in
          red needs a look.
        </p>

        <JobsPanel jobs={jobs} runs={runs} now={now} />

        <StripePanel stripe={stripe} now={now} />

        <ConnectionsPanel
          connections={connections}
          keys={companyKeys()}
          now={now}
        />

        <HealthPanel
          title='Website form emails'
          status={queueHealthy ? 'Draining' : 'Needs a look'}
          alert={!queueHealthy}
        >
          <dl className='grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0'>
            <Stat
              label='Waiting'
              value={queue.waiting}
              hint='Under an hour old. Normal while a send is in flight.'
            />
            <Stat
              label='Stuck'
              value={queue.stuck}
              hint='Over an hour late. Retried every 15 minutes for 72 hours.'
              alert={queue.stuck > 0}
            />
            <Stat
              label='Gave up'
              value={queue.gaveUp}
              hint='Never sent, in the last 30 days. Reply by hand.'
              alert={queue.gaveUp > 0}
            />
            <Stat
              label='Sent this week'
              value={queue.sentLastWeek}
              hint='Team notices sent in the last 7 days.'
            />
          </dl>
        </HealthPanel>

        <HealthPanel title='Notifications'>
          <dl className='grid grid-cols-2 sm:grid-cols-4'>
            <Stat
              label='Unread over a week'
              value={staleUnread}
              hint='Across everyone. A high number means people stopped reading them.'
            />
          </dl>
        </HealthPanel>
      </div>
    </PageShell>
  )
}
