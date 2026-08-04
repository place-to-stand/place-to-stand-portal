'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive,
  Check,
  ExternalLink,
  RefreshCw,
  Trash2,
  Undo2,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  FORM_SUBMISSION_KIND_LABELS,
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_SUBMISSION_STATUS_TOKENS,
  isUnacknowledgedSubmission,
} from '@/lib/form-submissions/constants'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'
import {
  acknowledgeSubmission,
  archiveSubmission,
  destroySubmission,
  restoreSubmission,
  unacknowledgeSubmission,
} from '../actions'

import { SubmissionArchiveDialog } from './submission-archive-dialog'

type SubmissionDetailSheetProps = {
  submission: FormSubmissionRecord | null
  mode: 'active' | 'archive'
  onOpenChange: (open: boolean) => void
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className='space-y-3'>
      <h3 className='text-sm font-semibold tracking-tight'>{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[9rem_1fr] gap-2 text-sm'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='break-words'>{value ?? '—'}</dd>
    </div>
  )
}

/** Renders `—` for null/empty so empty fields read consistently. */
function value(input: string | number | boolean | null | undefined) {
  if (input === null || input === undefined || input === '') {
    return '—'
  }
  if (typeof input === 'boolean') {
    return input ? 'Yes' : 'No'
  }
  return String(input)
}

function formatAnswer(
  raw: FormSubmissionRecord['responses'][number]
): React.ReactNode {
  if (raw.labels.length > 0) {
    return raw.labels.join(', ')
  }
  if (typeof raw.value === 'string' && raw.value.trim()) {
    return raw.value
  }
  if (Array.isArray(raw.value) && raw.value.length > 0) {
    return raw.value.join(', ')
  }
  return <span className='text-muted-foreground italic'>Unanswered</span>
}

export function SubmissionDetailSheet({
  submission,
  mode,
  onOpenChange,
}: SubmissionDetailSheetProps) {
  const router = useRouter()
  const { toast } = useToast()
  // D9: acknowledge/unacknowledge keep the sheet open, so the state is
  // lifted optimistically — the `submission` prop is stale until the parent
  // re-renders from router.refresh().
  const [ackOverride, setAckOverride] = useState<{
    id: string
    acknowledged: boolean
  } | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [destroyConfirmOpen, setDestroyConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Keep-open actions: run, then refresh underneath the open sheet.
  const runInlineAction = useCallback(
    (
      action: (input: { id: string }) => Promise<{ error?: string }>,
      errorTitle: string,
      onSuccess: () => void
    ) => {
      if (!submission) {
        return
      }

      startTransition(async () => {
        const result = await action({ id: submission.id })

        if (result.error) {
          toast({
            title: errorTitle,
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        onSuccess()
        router.refresh()
      })
    },
    [router, submission, toast]
  )

  const handleAcknowledge = useCallback(() => {
    if (!submission) {
      return
    }
    runInlineAction(
      acknowledgeSubmission,
      'Unable to acknowledge submission',
      () => setAckOverride({ id: submission.id, acknowledged: true })
    )
  }, [runInlineAction, submission])

  const handleUnacknowledge = useCallback(() => {
    if (!submission) {
      return
    }
    runInlineAction(
      unacknowledgeSubmission,
      'Unable to unacknowledge submission',
      () => setAckOverride({ id: submission.id, acknowledged: false })
    )
  }, [runInlineAction, submission])

  // D9: archive/restore/destroy CLOSE the sheet — the row leaves the
  // current tab's list.
  const runClosingAction = useCallback(
    (
      action: (input: { id: string }) => Promise<{ error?: string }>,
      errorTitle: string
    ) => {
      if (!submission) {
        return
      }

      startTransition(async () => {
        const result = await action({ id: submission.id })

        if (result.error) {
          toast({
            title: errorTitle,
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        onOpenChange(false)
        router.refresh()
      })
    },
    [onOpenChange, router, submission, toast]
  )

  const handleArchiveConfirm = useCallback(() => {
    setArchiveConfirmOpen(false)
    runClosingAction(archiveSubmission, 'Unable to archive submission')
  }, [runClosingAction])

  const handleRestore = useCallback(() => {
    runClosingAction(restoreSubmission, 'Unable to restore submission')
  }, [runClosingAction])

  const handleDestroyConfirm = useCallback(() => {
    setDestroyConfirmOpen(false)
    runClosingAction(
      destroySubmission,
      'Unable to permanently delete submission'
    )
  }, [runClosingAction])

  if (!submission) {
    return null
  }

  const override = ackOverride?.id === submission.id ? ackOverride : null
  const acknowledged = override
    ? override.acknowledged
    : submission.acknowledgedAt !== null
  const unacknowledged =
    mode === 'active' &&
    !acknowledged &&
    isUnacknowledgedSubmission({ ...submission, acknowledgedAt: null })
  const acknowledgedAt = submission.acknowledgedAt

  const isAudit = submission.kind === 'audit'
  const hasAttribution = Boolean(
    submission.utmSource ||
      submission.utmMedium ||
      submission.utmCampaign ||
      submission.utmTerm ||
      submission.utmContent ||
      submission.gclid ||
      submission.referrer ||
      submission.landingPath
  )

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent size='xl' className='overflow-y-auto'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            {FORM_SUBMISSION_KIND_LABELS[submission.kind]} submission
            <Badge
              variant='outline'
              className={cn(FORM_SUBMISSION_STATUS_TOKENS[submission.status])}
            >
              {FORM_SUBMISSION_STATUS_LABELS[submission.status]}
            </Badge>
            {unacknowledged ? (
              <Badge variant='secondary'>Unacknowledged</Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {format(new Date(submission.startedAt), "d MMM yyyy 'at' HH:mm")}
            {submission.durationMs !== null &&
              ` · ${Math.round(submission.durationMs / 1000)}s on page`}
            {mode === 'active' && acknowledged
              ? ` · ${
                  override
                    ? 'Acknowledged just now'
                    : acknowledgedAt
                      ? `Acknowledged ${formatDistanceToNow(
                          new Date(acknowledgedAt),
                          { addSuffix: true }
                        )}`
                      : 'Acknowledged'
                }`
              : null}
          </SheetDescription>
        </SheetHeader>

        <div className='space-y-6 px-4 pb-24'>
          <Section title='Contact'>
            <dl className='space-y-2'>
              <Field label='Name' value={value(submission.contactName)} />
              <Field
                label='Email'
                value={
                  submission.contactEmail ? (
                    // PW2: the natural post-triage action is emailing the
                    // prospect — make the address actionable.
                    <a
                      href={`mailto:${submission.contactEmail}`}
                      className='text-primary hover:underline'
                    >
                      {submission.contactEmail}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
              <Field label='Company' value={value(submission.contactCompany)} />
              <Field label='Website' value={value(submission.contactWebsite)} />
              <Field
                label='Marketing consent'
                value={value(submission.marketingConsent)}
              />
            </dl>
            {submission.message && (
              <p className='bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap'>
                {submission.message}
              </p>
            )}
          </Section>

          {isAudit && (
            <>
              <Separator />
              <Section title={`Answers (${submission.answeredCount ?? 0} of ${submission.questionsTotal ?? 0})`}>
                {submission.responses.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    No answers recorded.
                  </p>
                ) : (
                  <ol className='space-y-3'>
                    {submission.responses.map((response, index) => (
                      <li
                        key={`${response.questionId}-${index}`}
                        className='space-y-1'
                      >
                        <p className='text-muted-foreground text-xs'>
                          {response.sectionId}
                        </p>
                        <p className='text-sm font-medium'>{response.prompt}</p>
                        <p className='text-sm'>{formatAnswer(response)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </>
          )}

          {submission.result && (
            <>
              <Separator />
              <Section title='Result'>
                <dl className='space-y-2'>
                  <Field
                    label='Phase'
                    value={value(submission.result.phaseName)}
                  />
                  <Field
                    label='Generated by'
                    value={value(submission.result.generatedBy)}
                  />
                </dl>
                <p className='text-sm'>{submission.result.summary}</p>
                {submission.result.recommendations.length > 0 && (
                  <ul className='space-y-3'>
                    {submission.result.recommendations.map(rec => (
                      <li
                        key={rec.serviceId}
                        className='rounded-md border p-3 text-sm'
                      >
                        <div className='flex items-center justify-between gap-2'>
                          <span className='font-medium'>{rec.serviceName}</span>
                          <span className='text-muted-foreground text-xs'>
                            score {rec.score}
                          </span>
                        </div>
                        {rec.reasons.length > 0 && (
                          <ul className='text-muted-foreground mt-2 list-disc space-y-1 pl-4 text-xs'>
                            {rec.reasons.map((reason, index) => (
                              <li key={index}>{reason}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}

          {hasAttribution && (
            <>
              <Separator />
              <Section title='Attribution'>
                <dl className='space-y-2'>
                  <Field label='Source' value={value(submission.utmSource)} />
                  <Field label='Medium' value={value(submission.utmMedium)} />
                  <Field
                    label='Campaign'
                    value={value(submission.utmCampaign)}
                  />
                  <Field label='Term' value={value(submission.utmTerm)} />
                  <Field label='Content' value={value(submission.utmContent)} />
                  <Field label='GCLID' value={value(submission.gclid)} />
                  <Field label='Referrer' value={value(submission.referrer)} />
                  <Field
                    label='Landing path'
                    value={value(submission.landingPath)}
                  />
                </dl>
              </Section>
            </>
          )}

          <Separator />
          <Section title='Session'>
            <dl className='space-y-2'>
              <Field label='Source' value={value(submission.sourceDetail)} />
              <Field label='Viewport' value={value(submission.viewport)} />
              <Field
                label='Screen width'
                value={
                  submission.screenWidth ? `${submission.screenWidth}px` : '—'
                }
              />
              <Field label='Timezone' value={value(submission.timezone)} />
              <Field label='Language' value={value(submission.language)} />
              <Field label='User agent' value={value(submission.userAgent)} />
              <Field
                label='Session key'
                value={
                  <code className='text-xs'>{submission.sessionKey}</code>
                }
              />
            </dl>
            {submission.posthogReplayUrl && (
              <a
                href={submission.posthogReplayUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary inline-flex items-center gap-1 text-sm hover:underline'
              >
                Watch session replay
                <ExternalLink className='size-3' />
              </a>
            )}
          </Section>
        </div>

        {/* Fixed footer, matching the house sheet pattern (hour-block sheet):
            primary actions left, destructive icon-only action right. */}
        <div className='border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 fixed right-0 bottom-0 z-50 w-full border-t shadow-lg backdrop-blur sm:max-w-xl'>
          <div className='flex w-full items-center justify-between gap-3 px-6 py-4'>
            <div className='flex items-center gap-2'>
              {mode === 'active' ? (
                unacknowledged ? (
                  <Button
                    type='button'
                    disabled={isPending}
                    onClick={handleAcknowledge}
                  >
                    <Check className='mr-1 h-4 w-4' />
                    {isPending ? 'Acknowledging…' : 'Acknowledge'}
                  </Button>
                ) : acknowledged ? (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={isPending}
                    onClick={handleUnacknowledge}
                  >
                    <Undo2 className='mr-1 h-4 w-4' />
                    Unacknowledge
                  </Button>
                ) : null
              ) : (
                <Button
                  type='button'
                  variant='secondary'
                  disabled={isPending}
                  onClick={handleRestore}
                >
                  <RefreshCw className='mr-1 h-4 w-4' />
                  Restore
                </Button>
              )}
            </div>
            {mode === 'active' ? (
              <Button
                type='button'
                variant='destructive'
                size='icon'
                title='Archive submission'
                aria-label='Archive submission'
                disabled={isPending}
                onClick={() => setArchiveConfirmOpen(true)}
              >
                <Archive className='h-4 w-4' />
                <span className='sr-only'>Archive</span>
              </Button>
            ) : (
              <Button
                type='button'
                variant='destructive'
                size='icon'
                title='Permanently delete submission'
                aria-label='Permanently delete submission'
                disabled={isPending}
                onClick={() => setDestroyConfirmOpen(true)}
              >
                <Trash2 className='h-4 w-4' />
                <span className='sr-only'>Delete permanently</span>
              </Button>
            )}
          </div>
        </div>

        <SubmissionArchiveDialog
          open={archiveConfirmOpen}
          confirmDisabled={isPending}
          onCancel={() => setArchiveConfirmOpen(false)}
          onConfirm={handleArchiveConfirm}
        />

        <ConfirmDialog
          open={destroyConfirmOpen}
          title='Permanently delete submission?'
          description={`Permanently deleting the submission from ${
            submission.contactName ||
            submission.contactEmail ||
            'this anonymous visitor'
          } removes it and its history. This action cannot be undone.`}
          confirmLabel='Delete forever'
          confirmVariant='destructive'
          confirmDisabled={isPending}
          onCancel={() => setDestroyConfirmOpen(false)}
          onConfirm={handleDestroyConfirm}
        />
      </SheetContent>
    </Sheet>
  )
}
