'use client'

import { useTransition } from 'react'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { formatCalendarDate } from '@pts/ui/dates'
import { toast } from '@/components/ui/use-toast'
import type { CloseDrift } from '@/lib/data/reports/close'

import { recloseMonthAction } from '../actions/reclose-month'
import { formatMoney, formatSignedMoney } from './format'

type DriftNoticeProps = {
  year: number
  month: number
  displayMonth: string
  drift: CloseDrift
}

const MAX_VISIBLE_DELTAS = 12

type DriftUnit = CloseDrift['deltas'][number]['unit']

function formatValue(value: number, unit: DriftUnit): string {
  switch (unit) {
    case 'hours':
      return `${value.toFixed(2)} hrs`
    case 'rate':
      return `${formatMoney(value)}/hr`
    case 'flag':
      return value ? 'Yes' : 'No'
    default:
      return formatMoney(value)
  }
}

function formatDifference(delta: number, unit: DriftUnit): string {
  // A flag has no magnitude — it flipped, that's the whole story.
  if (unit === 'flag') return delta >= 0 ? 'Turned on' : 'Turned off'
  if (unit === 'hours') {
    return `${delta < 0 ? '−' : '+'}${Math.abs(delta).toFixed(2)} hrs`
  }
  if (unit === 'rate') return `${formatSignedMoney(delta)}/hr`
  return formatSignedMoney(delta)
}

function describeLateRecord(record: CloseDrift['lateRecords'][number]): string {
  const verb =
    record.change === 'deleted'
      ? 'removed'
      : record.change === 'added'
        ? 'recorded'
        : 'edited'
  const what = record.kind === 'time_log' ? 'time log' : 'hour block'
  const client = record.clientName ? ` for ${record.clientName}` : ''
  const dated = formatCalendarDate(record.eventDate, {
    month: 'short',
    day: 'numeric',
  })
  const when = formatCalendarDate(record.recordedAt, {
    month: 'short',
    day: 'numeric',
  })
  return `A ${record.hours.toFixed(2)} hr ${what}${client}, dated ${dated}, was ${verb} ${when}.`
}

/**
 * Unreconciled-books warning on a closed month whose live numbers differ
 * from the close. No dismiss: it stays until the month is re-closed.
 */
export function DriftNotice({
  year,
  month,
  displayMonth,
  drift,
}: DriftNoticeProps) {
  const [isPending, startTransition] = useTransition()

  const handleReclose = () => {
    startTransition(async () => {
      const result = await recloseMonthAction({ year, month })
      if (result.error) {
        toast({
          title: 'Unable to re-close month',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        toast({ title: `${displayMonth} re-closed` })
      }
    })
  }

  // One rate-schedule edit can produce dozens of deltas: show the first slice
  // and say plainly how many were left out.
  const visible = drift.deltas.slice(0, MAX_VISIBLE_DELTAS)
  const hiddenCount = drift.deltas.length - visible.length
  const causes = drift.lateRecords.slice(0, 3).map(describeLateRecord)
  const moreCauses = drift.lateRecords.length - causes.length

  return (
    <section
      aria-labelledby='drift-title'
      className='border-destructive/35 bg-destructive/5 dark:bg-destructive/10 overflow-hidden rounded-xl border'
    >
      <div className='flex flex-wrap items-center justify-between gap-3 px-5 py-3.5'>
        <div className='flex min-w-0 items-start gap-2.5'>
          <TriangleAlert className='text-destructive mt-0.5 size-4 shrink-0' />
          <div className='flex min-w-0 flex-col gap-0.5'>
            <h2
              id='drift-title'
              className='text-destructive text-sm font-semibold'
            >
              Live data differs from the {displayMonth} close
            </h2>
            <p className='text-foreground/80 text-[13px]'>
              {causes.length > 0
                ? `${causes.join(' ')}${moreCauses > 0 ? ` And ${moreCauses} more late change${moreCauses === 1 ? '' : 's'}.` : ''}`
                : 'No late time logs or hour blocks explain this. A change with no late record is usually a billing term, partner assignment, or Mercury transaction posted after the close.'}
            </p>
          </div>
        </div>
        <Button
          type='button'
          size='sm'
          disabled={isPending}
          onClick={handleReclose}
        >
          {isPending ? 'Re-closing…' : `Re-close ${displayMonth}`}
        </Button>
      </div>
      <div className='bg-card border-destructive/20 border-t'>
        <table className='w-full table-fixed text-[13px]'>
          <thead>
            <tr className='border-b'>
              <th className='text-muted-foreground h-8 pr-2 pl-11 text-left text-xs font-medium'>
                Changed
              </th>
              <th className='text-muted-foreground w-32 px-2 text-right text-xs font-medium'>
                At close
              </th>
              <th className='text-muted-foreground w-32 px-2 text-right text-xs font-medium'>
                Live
              </th>
              <th className='text-muted-foreground w-32 pr-5 pl-2 text-right text-xs font-medium'>
                Difference
              </th>
            </tr>
          </thead>
          <tbody className='divide-border/50 divide-y'>
            {visible.map(delta => (
              <tr key={`${delta.section}:${delta.label}:${delta.unit}`}>
                <td className='py-1.5 pr-2 pl-11'>{delta.label}</td>
                <td className='text-muted-foreground px-2 py-1.5 text-right tabular-nums'>
                  {formatValue(delta.snapshotValue, delta.unit)}
                </td>
                <td className='px-2 py-1.5 text-right tabular-nums'>
                  {formatValue(delta.liveValue, delta.unit)}
                </td>
                <td className='py-1.5 pr-5 pl-2 text-right font-medium tabular-nums'>
                  {formatDifference(
                    delta.liveValue - delta.snapshotValue,
                    delta.unit
                  )}
                </td>
              </tr>
            ))}
            {hiddenCount > 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className='text-muted-foreground py-2 pr-5 pl-11 text-xs'
                >
                  …and {hiddenCount} more difference
                  {hiddenCount === 1 ? '' : 's'} not shown.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
