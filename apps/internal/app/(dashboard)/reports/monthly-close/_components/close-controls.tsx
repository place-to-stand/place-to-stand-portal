'use client'

import { useState, useTransition } from 'react'
import { Lock, LockOpen } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'

import { closeMonthAction } from '../actions/close-month'
import { reopenMonthAction } from '../actions/reopen-month'

type CloseControlsProps = {
  /** 1-indexed month + year of the period being viewed (W4: page converts). */
  year: number
  month: number
  displayMonth: string
  status: 'open' | 'closed'
  isCurrentMonth: boolean
}

export function CloseControls({
  year,
  month,
  displayMonth,
  status,
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
    // No status chip here — the ClosedNotice banner below the header already
    // carries the closed-by/when message; duplicating it reads as clutter.
    return (
      <div className='flex items-center gap-2'>
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

  // The in-progress month can't be closed from the UI — closing implies the
  // period is over. (The server still allows re-close so a drift fix on an
  // already-closed current month keeps working.)
  if (isCurrentMonth) {
    return null
  }

  const closeDescription = `Snapshot billing, payouts, and commissions for ${displayMonth}. Late changes will be flagged as drift.`

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
