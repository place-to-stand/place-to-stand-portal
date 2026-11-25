'use client'

import { Check, RefreshCw, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react'

import { Button } from '@placetostand/ui/button'
// oxlint-disable-next-line no-restricted-imports -- a read-only sheet: its footer holds actions, not a save
import { SheetFooterBar } from '@/components/sheets/sheet-form-footer'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import type { FeedbackRowState } from '@/lib/feedback/tokens'
import type { FeedbackReportRecord } from '@/lib/feedback/types'

import {
  acknowledgeFeedback,
  markFeedbackNotSpam,
  markFeedbackSpam,
  restoreFeedback,
  unacknowledgeFeedback,
} from '../actions'

export type FeedbackSheetRun = (
  action: (input: { id: string }) => Promise<{ error?: string }>,
  errorTitle: string,
  options?: { closes?: boolean }
) => void

/**
 * The sheet's footer: each button saves on its own click. Spam on the left;
 * on the right the next step for the report's state, Turn into task last.
 */
export function FeedbackSheetFooter({
  shown,
  state,
  archived,
  isPending,
  run,
  onTurnIntoTask,
}: {
  shown: FeedbackReportRecord
  state: FeedbackRowState
  archived: boolean
  isPending: boolean
  run: FeedbackSheetRun
  onTurnIntoTask: () => void
}) {
  const isSpam = state === 'spam'
  const TaskIcon = ENTITY_ICONS.task

  return (
    <SheetFooterBar>
      {archived ? (
        <span />
      ) : isSpam ? (
        <span />
      ) : (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          disabled={isPending}
          onClick={() =>
            run(markFeedbackSpam, 'Unable to mark the report as spam')
          }
        >
          <ShieldAlert />
          Mark as spam
        </Button>
      )}
      <div className='flex items-center gap-2'>
        {archived ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={isPending}
            onClick={() =>
              run(restoreFeedback, 'Unable to restore the report', {
                closes: true,
              })
            }
          >
            <RefreshCw />
            Restore
          </Button>
        ) : isSpam ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={isPending}
            onClick={() =>
              run(markFeedbackNotSpam, 'Unable to mark the report as not spam')
            }
          >
            <ShieldCheck />
            Not spam
          </Button>
        ) : (
          <>
            {state === 'new' ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={isPending}
                onClick={() =>
                  run(acknowledgeFeedback, 'Unable to mark the report as seen')
                }
              >
                <Check />
                Mark as seen
              </Button>
            ) : state === 'seen' ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={isPending}
                onClick={() =>
                  run(unacknowledgeFeedback, 'Unable to mark the report as new')
                }
              >
                <Undo2 />
                Mark as new
              </Button>
            ) : null}
            {shown.taskId ? null : (
              <Button
                type='button'
                size='sm'
                disabled={isPending}
                onClick={onTurnIntoTask}
              >
                <TaskIcon />
                Turn into task
              </Button>
            )}
          </>
        )}
      </div>
    </SheetFooterBar>
  )
}
