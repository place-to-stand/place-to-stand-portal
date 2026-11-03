'use client'

import { useState, useTransition } from 'react'
import { Lock, LockOpen } from 'lucide-react'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { toast } from '@/components/ui/use-toast'
import type { ProfitShareState } from '@/lib/data/reports/types'

import { closeMonthAction } from '../actions/close-month'
import { reopenMonthAction } from '../actions/reopen-month'
import { formatCurrency } from '@pts/ui/numbers'

import { formatShortDay } from './format'

type CloseControlsProps = {
  /** 1-indexed month + year of the period being viewed (W4: page converts). */
  year: number
  month: number
  displayMonth: string
  status: 'open' | 'closed'
  payoutsTotal: number
  profitShare: ProfitShareState
}

export function CloseControls({
  year,
  month,
  displayMonth,
  status,
  payoutsTotal,
  profitShare,
}: CloseControlsProps) {
  const [confirming, setConfirming] = useState<'close' | 'reopen' | null>(null)
  const [isPending, startTransition] = useTransition()

  const runAction = (kind: 'close' | 'reopen') => {
    startTransition(async () => {
      const action = kind === 'close' ? closeMonthAction : reopenMonthAction
      const result = await action({ year, month })

      if (result.error) {
        toast({
          title:
            kind === 'close'
              ? 'Unable to close month'
              : 'Unable to reopen month',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        toast({
          title:
            kind === 'close'
              ? `${displayMonth} closed`
              : `${displayMonth} reopened`,
        })
      }
      setConfirming(null)
    })
  }

  if (status === 'closed') {
    const reopenDescription =
      profitShare.status === 'ready'
        ? `Discards the saved numbers. Closing again re-reads the ${formatShortDay(profitShare.data.asOfDate)} Mercury balance and recalculates the profit share.`
        : 'Discards the saved numbers. The report is live again until you close it.'

    return (
      <>
        <Button
          type='button'
          variant='outline'
          disabled={isPending}
          onClick={() => setConfirming('reopen')}
        >
          <LockOpen />
          Reopen…
        </Button>
        <ConfirmDialog
          open={confirming === 'reopen'}
          title={`Reopen ${displayMonth}?`}
          description={reopenDescription}
          confirmLabel='Reopen'
          confirmVariant='destructive'
          confirmDisabled={isPending}
          onConfirm={() => runAction('reopen')}
          onCancel={() => setConfirming(null)}
        />
      </>
    )
  }

  // A close freezes the profit share, so it needs a readable balance.
  const blockedReason =
    profitShare.status === 'unavailable'
      ? 'Load the Mercury balance before closing.'
      : null

  return (
    <>
      <DisabledFieldTooltip
        disabled={Boolean(blockedReason)}
        reason={blockedReason}
      >
        <Button
          type='button'
          disabled={isPending || Boolean(blockedReason)}
          onClick={() => setConfirming('close')}
        >
          <Lock />
          Close {displayMonth}
        </Button>
      </DisabledFieldTooltip>
      <ConfirmDialog
        open={confirming === 'close'}
        title={`Close ${displayMonth}?`}
        description={
          profitShare.status === 'ready'
            ? `Saves these numbers and the ${formatShortDay(profitShare.data.asOfDate)} Mercury balance. Late changes will show as drift.`
            : 'Saves these numbers. Late changes will show as drift.'
        }
        confirmLabel={isPending ? 'Closing…' : 'Close month'}
        confirmDisabled={isPending}
        onConfirm={() => runAction('close')}
        onCancel={() => setConfirming(null)}
      >
        <CloseSummary payoutsTotal={payoutsTotal} profitShare={profitShare} />
      </ConfirmDialog>
    </>
  )
}

function CloseSummary({
  payoutsTotal,
  profitShare,
}: {
  payoutsTotal: number
  profitShare: ProfitShareState
}) {
  const data = profitShare.status === 'ready' ? profitShare.data : null

  return (
    <dl className='divide-border/60 divide-y rounded-lg border text-sm'>
      <div className='flex items-center justify-between gap-3 px-3 py-2'>
        <dt className='text-muted-foreground'>Partner payouts</dt>
        <dd className='tabular-nums'>{formatCurrency(payoutsTotal)}</dd>
      </div>
      {data ? (
        <>
          <div className='flex items-center justify-between gap-3 px-3 py-2'>
            <dt className='text-muted-foreground flex flex-col'>
              Mercury balance
              <span className='text-xs'>
                End of day {formatShortDay(data.asOfDate)}
              </span>
            </dt>
            <dd className='tabular-nums'>{formatCurrency(data.balance)}</dd>
          </div>
          <div className='bg-muted/50 flex items-center justify-between gap-3 px-3 py-2'>
            <dt className='flex flex-col font-medium'>
              Profit share
              <span className='text-muted-foreground text-xs font-normal'>
                {data.totalAmount > 0
                  ? `${formatCurrency(data.partners[0]?.amount ?? 0)} each`
                  : 'No profit share this month'}
              </span>
            </dt>
            <dd className='font-medium tabular-nums'>
              {formatCurrency(data.totalAmount)}
            </dd>
          </div>
        </>
      ) : null}
    </dl>
  )
}
