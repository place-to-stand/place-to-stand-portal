import { formatRelativeTime } from '@pts/ui/dates'

import type { JobRunSummary } from '@/lib/health/runs'
import {
  describeSchedule,
  jobState,
  type JobState,
  type ScheduledJob,
} from '@/lib/health/scheduled-jobs'

import { HealthPanel, PanelNote, StateLabel } from './health-parts'

const STATE_WORDS: Record<JobState, string> = {
  ok: 'OK',
  failed: 'Failed',
  late: 'Late',
  unrecorded: 'No runs yet',
}

/** Each scheduled job: what it does, when it runs, and how its last run went. */
export function JobsPanel({
  jobs,
  runs,
  now,
}: {
  jobs: ScheduledJob[]
  runs: Map<string, JobRunSummary>
  now: Date
}) {
  const states = jobs.map(job => {
    const run = runs.get(job.path)
    return run ? jobState(run, job.schedule, now) : 'unrecorded'
  })
  const problems = states.filter(
    state => state === 'failed' || state === 'late'
  ).length

  return (
    <HealthPanel
      title='Scheduled jobs'
      status={problems ? `${problems} need a look` : 'Running'}
      alert={problems > 0}
    >
      <ul className='divide-y'>
        {jobs.map((job, index) => {
          const run = runs.get(job.path)
          const state = states[index] ?? 'unrecorded'
          return (
            <li
              key={job.path}
              className='grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,14rem)] md:gap-4'
            >
              <div className='flex flex-col gap-0.5'>
                <span className='text-sm font-semibold'>{job.name}</span>
                <span className='text-muted-foreground text-sm'>
                  {describeSchedule(job.schedule)}
                </span>
              </div>
              <span className='text-sm'>{job.does}</span>
              <div className='flex flex-col gap-0.5'>
                <StateLabel alert={state === 'failed' || state === 'late'}>
                  {STATE_WORDS[state]}
                  {run?.lastRunAt
                    ? `, ${formatRelativeTime(run.lastRunAt, now)}`
                    : ''}
                </StateLabel>
                {state === 'failed' && run?.lastOkAt ? (
                  <span className='text-muted-foreground text-xs'>
                    Last worked {formatRelativeTime(run.lastOkAt, now)}
                  </span>
                ) : null}
                {run && run.failedLastWeek > 0 ? (
                  <span className='text-muted-foreground text-xs'>
                    {run.failedLastWeek} failed this week
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      <PanelNote>
        Late means no run in twice its schedule. Runs are kept 90 days.
      </PanelNote>
    </HealthPanel>
  )
}
