'use client'

import { useTransition } from 'react'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { formatCalendarDate } from '@pts/ui/dates'
import { toast } from '@/components/ui/use-toast'
import type { CloseDrift } from '@/lib/data/reports/close'

import { recloseMonthAction } from '../actions/reclose-month'
import { formatCurrency, formatHours } from '@pts/ui/numbers'

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
      return formatHours(value)
    case 'rate':
      return `${formatCurrency(value)}/hr`
    case 'flag':
      return value ? 'Yes' : 'No'
    default:
      return formatCurrency(value)
  }
}

function formatDifference(delta: number, unit: DriftUnit): string {
  // A flag has no magnitude — it flipped, that's the whole story.
  if (unit === 'flag') return delta >= 0 ? 'Turned on' : 'Turned off'
  if (unit === 'hours') {
    return formatHours(delta, { signed: true })
  }
  if (unit === 'rate') return `${formatCurrency(delta, { signed: true })}/hr`
  return formatCurrency(delta, { signed: true })
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
  return `A ${formatHours(record.hours)} ${what}${client}, dated ${dated}, was ${verb} ${when}.`
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
            <p className='text-foreground/80 text-sm'>
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
        <Table density='compact' className='table-fixed'>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='text-muted-foreground pl-11 text-xs font-medium'>
                Changed
              </TableHead>
              <TableHead className='text-muted-foreground w-32 text-right text-xs font-medium'>
                At close
              </TableHead>
              <TableHead className='text-muted-foreground w-32 text-right text-xs font-medium'>
                Live
              </TableHead>
              <TableHead className='text-muted-foreground w-32 pr-5 text-right text-xs font-medium'>
                Difference
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(delta => (
              <TableRow key={`${delta.section}:${delta.label}:${delta.unit}`}>
                <TableCell className='pl-11 whitespace-normal'>
                  {delta.label}
                </TableCell>
                <TableCell className='text-muted-foreground text-right tabular-nums'>
                  {formatValue(delta.snapshotValue, delta.unit)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatValue(delta.liveValue, delta.unit)}
                </TableCell>
                <TableCell className='pr-5 text-right font-medium tabular-nums'>
                  {formatDifference(
                    delta.liveValue - delta.snapshotValue,
                    delta.unit
                  )}
                </TableCell>
              </TableRow>
            ))}
            {hiddenCount > 0 ? (
              <TableRow className='hover:bg-transparent'>
                <TableCell
                  colSpan={4}
                  className='text-muted-foreground pr-5 pl-11 text-xs'
                >
                  …and {hiddenCount} more difference
                  {hiddenCount === 1 ? '' : 's'} not shown.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
