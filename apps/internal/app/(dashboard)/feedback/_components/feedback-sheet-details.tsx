'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

import { formatCalendarDate } from '@placetostand/ui/dates'
import { Separator } from '@placetostand/ui/separator'
import { SheetSection } from '@/components/sheets/sheet-section'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import type { FeedbackReportRecord } from '@/lib/feedback/types'
import { projectTaskHref, projectTasksHref } from '@/lib/sheets/hrefs'
import { cn } from '@/lib/utils'

const RECEIVED_STYLE = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const

const KV_GRID = 'grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2'

function Kv({
  label,
  value,
  wide = false,
}: {
  label: string
  value: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', wide && 'sm:col-span-2')}>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='min-w-0 text-sm break-words'>{value || '—'}</dd>
    </div>
  )
}

/** The report's facts: project, client, reporter, page and task. */
export function FeedbackReportFacts({
  shown,
}: {
  shown: FeedbackReportRecord
}) {
  const projectHref = projectTasksHref(shown)
  const taskHref = shown.taskId ? projectTaskHref(shown, shown.taskId) : null
  const TaskIcon = ENTITY_ICONS.task

  return (
    <dl className={KV_GRID}>
      <Kv
        label='Project'
        value={
          projectHref ? (
            <Link href={projectHref} className='text-primary hover:underline'>
              {shown.projectName}
            </Link>
          ) : (
            shown.projectName
          )
        }
      />
      <Kv label='Client' value={shown.clientName} />
      <Kv
        label='From'
        value={
          shown.reporterName || shown.reporterEmail ? (
            <span className='flex flex-col'>
              {shown.reporterName ? <span>{shown.reporterName}</span> : null}
              {shown.reporterEmail ? (
                <a
                  href={`mailto:${shown.reporterEmail}`}
                  className='text-primary hover:underline'
                >
                  {shown.reporterEmail}
                </a>
              ) : null}
            </span>
          ) : (
            'Anonymous'
          )
        }
      />
      <Kv
        label='Received'
        value={formatCalendarDate(shown.createdAt, RECEIVED_STYLE)}
      />
      <Kv
        label='Page'
        wide
        value={
          shown.pageUrl ? (
            <a
              href={shown.pageUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary inline-flex items-center gap-1 hover:underline'
            >
              <span className='break-all'>
                {shown.pageTitle || shown.pageUrl}
              </span>
              <ExternalLink className='size-3 shrink-0' />
            </a>
          ) : null
        }
      />
      {shown.taskId ? (
        <Kv
          label='Task'
          wide
          value={
            taskHref && !shown.taskArchived ? (
              <Link
                href={taskHref}
                className='text-primary inline-flex items-center gap-1.5 hover:underline'
              >
                <TaskIcon className='size-3.5 shrink-0' />
                {shown.taskTitle}
              </Link>
            ) : (
              `${shown.taskTitle ?? 'Task'}${shown.taskArchived ? ' (archived)' : ''}`
            )
          }
        />
      ) : null}
    </dl>
  )
}

/** The screenshot (when there is one) and the reporter's browser session. */
export function FeedbackReportSession({
  shown,
}: {
  shown: FeedbackReportRecord
}) {
  return (
    <>
      {shown.screenshotPath ? (
        <>
          <Separator />
          <SheetSection title='Screenshot'>
            <a
              href={`/api/storage/feedback-screenshot/${shown.id}`}
              target='_blank'
              rel='noopener noreferrer'
              className='block overflow-hidden rounded-md border'
            >
              {/* oxlint-disable-next-line next-js/no-img-element -- a private, signed-in image route; next/image can't optimise it */}
              <img
                src={`/api/storage/feedback-screenshot/${shown.id}`}
                alt='What the reporter saw'
                className='h-auto w-full'
              />
            </a>
          </SheetSection>
        </>
      ) : null}

      <Separator />
      <SheetSection title='Session'>
        <dl className={KV_GRID}>
          <Kv label='Website' value={shown.origin} />
          <Kv label='Screen' value={shown.viewport} />
          <Kv label='Language' value={shown.language} />
          <Kv label='Time zone' value={shown.timezone} />
          <Kv label='Browser' value={shown.userAgent} wide />
        </dl>
        {shown.posthogReplayUrl ? (
          <a
            href={shown.posthogReplayUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary inline-flex w-fit items-center gap-1 text-sm hover:underline'
          >
            Watch session replay
            <ExternalLink className='size-3' />
          </a>
        ) : null}
      </SheetSection>
    </>
  )
}
