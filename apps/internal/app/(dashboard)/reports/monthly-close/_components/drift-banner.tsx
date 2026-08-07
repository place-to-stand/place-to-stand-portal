'use client'

import { useTransition } from 'react'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import type { CloseDrift } from '@/lib/data/reports/close'

import { recloseMonthAction } from '../actions/reclose-month'

type DriftBannerProps = {
  year: number
  month: number
  displayMonth: string
  drift: CloseDrift
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const formatValue = (value: number, unit: 'hours' | 'amount'): string =>
  unit === 'hours' ? `${value.toFixed(2)}h` : currency.format(value)

const formatSigned = (delta: number, unit: 'hours' | 'amount'): string => {
  const sign = delta >= 0 ? '+' : '−'
  return `${sign}${formatValue(Math.abs(delta), unit)}`
}

/**
 * Unreconciled-books warning on closed months whose live derivation differs
 * from the snapshot. No dismiss — it stays until the drift is resolved.
 */
export function DriftBanner({
  year,
  month,
  displayMonth,
  drift,
}: DriftBannerProps) {
  const [isPending, startTransition] = useTransition()

  const handleReclose = () => {
    startTransition(async () => {
      const result = await recloseMonthAction({ year, month })

      if (result.error) {
        toast({
          title: 'Re-close failed',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        toast({
          title: `${displayMonth} re-closed`,
          description: 'The frozen numbers now include the late changes.',
        })
      }
    })
  }

  const unexplained = drift.deltas.length > 0 && drift.lateRecords.length === 0

  return (
    <div className='border-destructive/40 bg-destructive/10 rounded-xl border px-4 py-3 text-sm'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-1.5'>
          <p className='text-destructive flex items-center gap-2 font-medium'>
            <TriangleAlert className='h-4 w-4 shrink-0' />
            Live data differs from the {displayMonth} close.
          </p>
          <ul className='text-destructive/90 space-y-0.5 pl-6'>
            {drift.deltas.map(delta => (
              <li key={`${delta.section}:${delta.label}:${delta.unit}`}>
                {delta.label}:{' '}
                {formatValue(delta.snapshotValue, delta.unit)} closed →{' '}
                {formatValue(delta.liveValue, delta.unit)} live (
                {formatSigned(delta.liveValue - delta.snapshotValue, delta.unit)}
                )
              </li>
            ))}
            {drift.lateRecords.map(record => (
              <li key={`${record.kind}:${record.id}`} className='text-xs'>
                • {record.change === 'deleted' ? 'Removed' : record.change === 'added' ? 'Late' : 'Edited'}{' '}
                {record.hours.toFixed(2)}h{' '}
                {record.kind === 'time_log' ? 'time log' : 'hour block'}
                {record.clientName ? ` for ${record.clientName}` : ''} (
                {record.kind === 'time_log' ? 'logged' : 'billed'}{' '}
                {record.eventDate}, recorded{' '}
                {new Date(record.recordedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
                )
              </li>
            ))}
            {unexplained ? (
              <li className='text-xs italic'>
                Cause unknown — compare sections manually (a billing-term or
                partner assignment change alters figures without a late
                record).
              </li>
            ) : null}
          </ul>
        </div>
        <Button
          type='button'
          variant='destructive'
          size='sm'
          disabled={isPending}
          onClick={handleReclose}
        >
          {isPending ? 'Re-closing…' : 'Reopen & re-close'}
        </Button>
      </div>
    </div>
  )
}
