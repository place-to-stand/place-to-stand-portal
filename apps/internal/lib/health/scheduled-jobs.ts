import vercelConfig from '../../vercel.json'

/** What each scheduled job does, in plain words, keyed by its route. */
const JOB_DESCRIPTIONS: Record<string, { name: string; does: string }> = {
  '/api/cron/retry-submission-emails': {
    name: 'Retry form emails',
    does: 'Resends website form emails that failed to go out, and posts to Google Chat when one is an hour late.',
  },
  '/api/cron/abandon-stale-submissions': {
    name: 'Close stale audits',
    does: 'Marks Opportunity Audits nobody finished as abandoned.',
  },
  '/api/cron/apply-role-terms': {
    name: 'Apply role changes',
    does: 'Switches people to a new role on the month it starts.',
  },
  '/api/cron/prune-activity-logs': {
    name: 'Prune old records',
    does: 'Deletes activity log rows past their keep date, notifications archived over 90 days ago and System health records over 90 days old.',
  },
}

export type ScheduledJob = {
  path: string
  schedule: string
  name: string
  does: string
}

/**
 * The scheduled jobs, read from `vercel.json` so this list can't drift from
 * what Vercel runs. A job without a description still shows, by its path.
 */
export function listScheduledJobs(): ScheduledJob[] {
  return (vercelConfig.crons ?? []).map(job => ({
    path: job.path,
    schedule: job.schedule,
    name: JOB_DESCRIPTIONS[job.path]?.name ?? job.path,
    does: JOB_DESCRIPTIONS[job.path]?.does ?? '',
  }))
}

/** "Every 15 minutes", "Daily at 06:30 UTC", "Mondays at 07:00 UTC". */
export function describeSchedule(cron: string): string {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.split(' ')
  const every = minute?.match(/^\*\/(\d+)$/)
  if (every && hour === '*') return `Every ${every[1]} minutes`
  const time =
    minute && hour && /^\d+$/.test(minute) && /^\d+$/.test(hour)
      ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC`
      : null
  if (!time || month !== '*') return cron
  if (dayOfMonth === '*' && dayOfWeek === '*') return `Daily at ${time}`
  const days = [
    'Sundays',
    'Mondays',
    'Tuesdays',
    'Wednesdays',
    'Thursdays',
    'Fridays',
    'Saturdays',
  ]
  if (dayOfMonth === '*' && dayOfWeek && /^\d$/.test(dayOfWeek)) {
    return `${days[Number(dayOfWeek)]} at ${time}`
  }
  return cron
}

/**
 * How often a schedule runs, in ms, or null for one this can't read. Used
 * to call a job late: no run in twice its interval.
 */
export function scheduleIntervalMs(cron: string): number | null {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.split(' ')
  if (month !== '*' || dayOfMonth !== '*') return null
  const every = minute?.match(/^\*\/(\d+)$/)
  if (every && hour === '*' && dayOfWeek === '*') {
    return Number(every[1]) * 60_000
  }
  if (!/^\d+$/.test(minute ?? '') || !/^\d+$/.test(hour ?? '')) return null
  if (dayOfWeek === '*') return 24 * 60 * 60_000
  if (/^\d$/.test(dayOfWeek ?? '')) return 7 * 24 * 60 * 60_000
  return null
}

export type JobState = 'ok' | 'failed' | 'late' | 'unrecorded'

/** A job's state from its latest run and its schedule. */
export function jobState(
  run: { lastRunAt: string | null; lastOutcome: string | null },
  schedule: string,
  now: Date
): JobState {
  if (!run.lastRunAt) return 'unrecorded'
  if (run.lastOutcome === 'failed') return 'failed'
  const interval = scheduleIntervalMs(schedule)
  if (
    interval &&
    now.getTime() - new Date(run.lastRunAt).getTime() > interval * 2
  ) {
    return 'late'
  }
  return 'ok'
}
