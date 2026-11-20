import type { Metadata } from 'next'

import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'
import { requirePage } from '@/lib/auth/session'
import {
  countStaleUnreadNotifications,
  readEmailQueueHealth,
} from '@/lib/health/queries'
import {
  describeSchedule,
  listScheduledJobs,
} from '@/lib/health/scheduled-jobs'
import {
  referenceCrumbs,
  referenceTabsFor,
} from '@/lib/navigation/reference-tabs'

export const metadata: Metadata = {
  title: 'System health | Reference',
}

export const dynamic = 'force-dynamic'

/**
 * Reference → System health: whether the work the portal does on its own is
 * keeping up: the website form email queue, stale unread notifications and
 * the scheduled jobs. Job runs aren't recorded, so each job shows its
 * schedule only.
 */
export default async function SystemHealthPage() {
  const user = await requirePage('settings.health')
  const [queue, staleUnread] = await Promise.all([
    readEmailQueueHealth(),
    countStaleUnreadNotifications(),
  ])
  const jobs = listScheduledJobs()
  const healthy = queue.stuck === 0 && queue.gaveUp === 0

  return (
    <PageShell
      breadcrumbs={referenceCrumbs('health')}
      tabs={referenceTabsFor(user.role)}
      activeTab='health'
    >
      <div className='w-full space-y-6'>
        <PagePanel
          aria-label='Website form emails'
          flush
          className='overflow-hidden'
        >
          <div className='bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-2.5'>
            <h2 className='text-sm font-semibold'>Website form emails</h2>
            <span
              className={
                healthy
                  ? 'text-muted-foreground text-xs'
                  : 'text-destructive text-xs font-semibold'
              }
            >
              {healthy ? 'Draining' : 'Needs a look'}
            </span>
          </div>
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
        </PagePanel>

        <PagePanel
          aria-label='Scheduled jobs'
          flush
          className='overflow-hidden'
        >
          <div className='bg-muted/40 border-b px-4 py-2.5'>
            <h2 className='text-sm font-semibold'>Scheduled jobs</h2>
          </div>
          <ul className='divide-y'>
            {jobs.map(job => (
              <li
                key={job.path}
                className='grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,12rem)_minmax(0,1fr)] md:gap-4'
              >
                <span className='text-sm font-semibold'>{job.name}</span>
                <span className='text-muted-foreground text-sm'>
                  {describeSchedule(job.schedule)}
                </span>
                <span className='text-sm'>{job.does}</span>
              </li>
            ))}
          </ul>
          <p className='text-muted-foreground border-t px-4 py-2.5 text-xs'>
            Runs aren&rsquo;t recorded yet, so last run and failures don&rsquo;t
            show here. Vercel&rsquo;s Cron Jobs page has them.
          </p>
        </PagePanel>

        <PagePanel aria-label='Notifications' flush className='overflow-hidden'>
          <div className='bg-muted/40 border-b px-4 py-2.5'>
            <h2 className='text-sm font-semibold'>Notifications</h2>
          </div>
          <dl className='grid grid-cols-2 sm:grid-cols-4'>
            <Stat
              label='Unread over a week'
              value={staleUnread}
              hint='Across everyone. A high number means people stopped reading them.'
            />
          </dl>
        </PagePanel>
      </div>
    </PageShell>
  )
}

function Stat({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string
  value: number
  hint: string
  alert?: boolean
}) {
  return (
    <div className='flex flex-col gap-1 px-4 py-3'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd
        className={
          alert
            ? 'text-destructive text-2xl font-semibold tabular-nums'
            : 'text-2xl font-semibold tabular-nums'
        }
      >
        {value}
      </dd>
      <dd className='text-muted-foreground text-xs'>{hint}</dd>
    </div>
  )
}
