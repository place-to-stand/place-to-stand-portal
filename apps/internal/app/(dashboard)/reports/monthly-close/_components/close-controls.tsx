'use client'

import { useState, useTransition } from 'react'
import { Lock, LockOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'

import { closeMonthAction } from '../actions/close-month'
import { reopenMonthAction } from '../actions/reopen-month'

type CloseControlsProps = {
  /** 1-indexed month + year of the period being viewed (W4: page converts). */
  year: number
  month: number
  displayMonth: string
  status: 'open' | 'closed'
  closedAt?: string
  closedByName?: string | null
  isCurrentMonth: boolean
}

export function CloseControls({
  year,
  month,
  displayMonth,
  status,
  closedAt,
  closedByName,
  isCurrentMonth,
}: CloseControlsProps) {
  const [confirming, setConfirming] = useState<'close' | 'reopen' | null>(null)
  const [isPending, startTransition] = useTransition()

  const runAction = (kind: 'close' | 'reopen') => {
    startTransition(async () => {
      const action = kind === 'close' ? closeMonthAction : reopenMonthAction
      const result = await action({ year, month })

      if (result.error) {
        toast({
          title: kind === 'close' ? 'Close failed' : 'Reopen failed',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        toast({
          title:
            kind === 'close'
              ? `${displayMonth} closed`
              : `${displayMonth} reopened`,
          description:
            kind === 'close'
              ? 'Numbers are frozen. Late changes will be flagged as drift.'
              : 'The report is live again. Close again when you are done.',
        })
      }
      setConfirming(null)
    })
  }

  if (status === 'closed') {
    const closedLabel = closedAt
      ? new Date(closedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : null

    return (
      <div className='flex items-center gap-2'>
        <Badge variant='outline' className='gap-1 text-xs'>
          <Lock className='h-3 w-3' />
          Closed
          {closedLabel ? ` ${closedLabel}` : ''}
          {closedByName ? ` by ${closedByName}` : ''}
        </Badge>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={isPending}
          onClick={() => setConfirming('reopen')}
        >
          <LockOpen className='mr-1 h-3.5 w-3.5' />
          Reopen…
        </Button>
        <ConfirmDialog
          open={confirming === 'reopen'}
          title={`Reopen ${displayMonth}?`}
          description='Reopening discards the frozen numbers and re-derives the report live. Close again when you are done.'
          confirmLabel='Reopen'
          confirmVariant='destructive'
          confirmDisabled={isPending}
          onConfirm={() => runAction('reopen')}
          onCancel={() => setConfirming(null)}
        />
      </div>
    )
  }

  const closeDescription = isCurrentMonth
    ? `${displayMonth} isn't over — you usually close after month end. Snapshot billing, payouts, and commissions now? Late changes will be flagged as drift.`
    : `Snapshot billing, payouts, and commissions for ${displayMonth}. Late changes will be flagged as drift.`

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={isPending}
        onClick={() => setConfirming('close')}
      >
        <Lock className='mr-1 h-3.5 w-3.5' />
        Close {displayMonth}
      </Button>
      <ConfirmDialog
        open={confirming === 'close'}
        title={`Close ${displayMonth}?`}
        description={closeDescription}
        confirmLabel='Close month'
        confirmDisabled={isPending}
        onConfirm={() => runAction('close')}
        onCancel={() => setConfirming(null)}
      />
    </>
  )
}
