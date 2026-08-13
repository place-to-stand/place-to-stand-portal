'use client'

import { History, Loader2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  DONE_WINDOW_WEEKS,
  formatDoneWindowLabel,
} from '@/lib/projects/tasks/done-window'

type DoneWindowFooterProps = {
  /** Current window width in weeks; always a multiple of DONE_WINDOW_WEEKS. */
  doneWeeks: number
  /** Assigned DONE tasks completed before the window. Zero hides the button. */
  hiddenCount: number
  /** Fetches and appends the next step. */
  onWiden: () => void
  isLoading: boolean
  error: string | null
}

export function DoneWindowFooter({
  doneWeeks,
  hiddenCount,
  onWiden,
  isLoading,
  error,
}: DoneWindowFooterProps) {
  const hasMore = hiddenCount > 0

  return (
    <div className='flex flex-col items-center gap-1 pt-4 pb-2'>
      {/*
        The column is filtered whether or not anything is currently hidden, so
        the rule is stated either way -- a column that silently drops finished
        work reads as a bug the first time you go looking for something.
      */}
      <p className='text-muted-foreground/70 px-2 text-center text-[11px] leading-snug'>
        {hasMore
          ? `Tasks are hidden ${formatDoneWindowLabel(doneWeeks)} after they're completed.`
          : `Showing everything completed in the last ${formatDoneWindowLabel(doneWeeks)}.`}
      </p>
      {hasMore ? (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-7 w-full text-xs'
          onClick={onWiden}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className='h-3.5 w-3.5 animate-spin' aria-hidden />
              Loading...
            </>
          ) : (
            <>
              <History className='h-3.5 w-3.5' aria-hidden />
              Load previous {DONE_WINDOW_WEEKS} weeks
            </>
          )}
        </Button>
      ) : null}
      {error ? (
        <p className='text-destructive px-2 text-center text-[11px]'>{error}</p>
      ) : null}
    </div>
  )
}
