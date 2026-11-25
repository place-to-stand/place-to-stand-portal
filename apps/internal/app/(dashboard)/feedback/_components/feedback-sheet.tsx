'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@placetostand/ui/badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SheetRecordMenu } from '@/components/sheets/sheet-record-menu'
import { SheetSection } from '@/components/sheets/sheet-section'
import { toastLink, useToast } from '@/components/ui/use-toast'
import { emitSheetRecordSaved } from '@/lib/sheets/record-saved'
import { FEEDBACK_TYPE_LABELS } from '@/lib/feedback/constants'
import {
  FEEDBACK_STATE_LABELS,
  FEEDBACK_STATE_TOKENS,
  FEEDBACK_TYPE_TOKENS,
  feedbackRowState,
} from '@/lib/feedback/tokens'
import type { FeedbackReportRecord } from '@/lib/feedback/types'
import { isSpamReason, SPAM_REASON_LABELS } from '@/lib/form-submissions/spam'

import { archiveFeedback, turnFeedbackIntoTask } from '../actions'
import { FeedbackArchiveDialog } from './feedback-archive-dialog'
import {
  FeedbackReportFacts,
  FeedbackReportSession,
} from './feedback-sheet-details'
import {
  FeedbackSheetFooter,
  type FeedbackSheetRun,
} from './feedback-sheet-footer'

type FeedbackSheetProps = {
  report: FeedbackReportRecord | null
  onOpenChange: (open: boolean) => void
  /** Called after an action moved the report off the current list. */
  onRowRemoved?: () => void
}

/**
 * One feedback report: what the reporter wrote, their screenshot, the page
 * and the session. Read-only; each action in the footer saves on its own
 * click. Turn into task is the main step; Archive is in the header menu.
 */
export function FeedbackSheet({
  report,
  onOpenChange,
  onRowRemoved,
}: FeedbackSheetProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [retained, setRetained] = useState(report)

  // Keep the last report through the close animation.
  if (report && report !== retained) setRetained(report)
  const shown = report ?? retained

  const run: FeedbackSheetRun = useCallback(
    (
      action: (input: { id: string }) => Promise<{ error?: string }>,
      errorTitle: string,
      { closes = false }: { closes?: boolean } = {}
    ) => {
      if (!shown) return
      startTransition(async () => {
        const result = await action({ id: shown.id })
        if (result.error) {
          toast({
            title: errorTitle,
            description: result.error,
            variant: 'destructive',
            link: toastLink('feedback', shown.id),
          })
          router.refresh()
          return
        }
        if (closes) {
          onOpenChange(false)
          if (onRowRemoved) {
            onRowRemoved()
            return
          }
        } else {
          // A sheet the SheetHost serves holds its own copy: reload it.
          emitSheetRecordSaved('feedback', shown.id)
        }
        router.refresh()
      })
    },
    [onOpenChange, onRowRemoved, router, shown, toast]
  )

  const handleTurnIntoTask = useCallback(() => {
    if (!shown) return
    startTransition(async () => {
      const result = await turnFeedbackIntoTask({ id: shown.id })
      if (result.error !== undefined) {
        toast({
          title: 'Unable to turn the report into a task',
          description: result.error,
          variant: 'destructive',
          link: toastLink('feedback', shown.id),
        })
        router.refresh()
        return
      }
      toast({
        title: 'Task created',
        description: 'It is on deck in the project, with nobody assigned.',
        link: toastLink('task', result.taskId),
      })
      emitSheetRecordSaved('feedback', shown.id)
      router.refresh()
    })
  }, [router, shown, toast])

  if (!shown) return null

  const archived = shown.deletedAt !== null
  const state = feedbackRowState(shown)
  const isSpam = state === 'spam'

  return (
    <Sheet open={Boolean(report)} onOpenChange={onOpenChange}>
      <SheetContent
        hideCloseButton
        className='flex w-full flex-col gap-0 overflow-hidden p-0'
      >
        <SheetFormHeader
          entity='feedback'
          title={`${FEEDBACK_TYPE_LABELS[shown.type]} report`}
          menu={
            archived ? null : (
              <SheetRecordMenu
                noun='Report'
                onRequestArchive={() => setArchiveOpen(true)}
                archiveDisabled={isPending}
              />
            )
          }
        />

        <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
          <div className='flex flex-1 flex-col gap-6 px-6 pt-6 pb-8 [&>*]:shrink-0'>
            <SheetSection
              title='Report'
              action={
                <div className='flex items-center gap-2'>
                  <Badge
                    variant='outline'
                    className={FEEDBACK_TYPE_TOKENS[shown.type]}
                  >
                    {FEEDBACK_TYPE_LABELS[shown.type]}
                  </Badge>
                  <Badge
                    variant='outline'
                    className={FEEDBACK_STATE_TOKENS[state]}
                  >
                    {FEEDBACK_STATE_LABELS[state]}
                  </Badge>
                </div>
              }
            >
              <p className='bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap'>
                {shown.message}
              </p>
              {isSpam && shown.spamReason ? (
                <p className='text-muted-foreground text-sm'>
                  {isSpamReason(shown.spamReason)
                    ? SPAM_REASON_LABELS[shown.spamReason]
                    : 'Spam'}
                </p>
              ) : null}
              <FeedbackReportFacts shown={shown} />
            </SheetSection>

            <FeedbackReportSession shown={shown} />
          </div>

          <div className='sticky bottom-0 z-10 mt-auto'>
            <FeedbackSheetFooter
              shown={shown}
              state={state}
              archived={archived}
              isPending={isPending}
              run={run}
              onTurnIntoTask={handleTurnIntoTask}
            />
          </div>
        </div>

        <FeedbackArchiveDialog
          open={archiveOpen}
          confirmDisabled={isPending}
          onCancel={() => setArchiveOpen(false)}
          onConfirm={() => {
            setArchiveOpen(false)
            run(archiveFeedback, 'Unable to archive the report', {
              closes: true,
            })
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
