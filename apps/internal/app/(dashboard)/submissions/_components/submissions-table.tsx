'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Archive,
  Check,
  Mail,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'

import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { PaginationControls } from '@/components/ui/pagination-controls'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useListParams } from '@/hooks/use-list-params'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'
import { formatCalendarDate, formatRelativeTime } from '@pts/ui/dates'
import {
  ATTRIBUTION_CHANNEL_LABELS,
  describeAttribution,
} from '@/lib/form-submissions/attribution'
import {
  ATTRIBUTION_CHANNEL_TOKENS,
  FORM_SUBMISSION_KIND_LABELS,
  FORM_SUBMISSION_KIND_TOKENS,
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_SUBMISSION_STATUS_TOKENS,
  isFormSubmissionKind,
  isFormSubmissionStatus,
  isUnacknowledgedSubmission,
} from '@/lib/form-submissions/constants'
import {
  isContactFilterValue,
  isSubmissionSortValue,
} from '@/lib/form-submissions/filters'
import { describeSubmissionOutcome } from '@/lib/form-submissions/outcome'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'
import {
  acknowledgeSubmission,
  archiveSubmission,
  destroySubmission,
  restoreSubmission,
} from '../actions'

import { SubmissionArchiveDialog } from './submission-archive-dialog'
import { SubmissionDetailSheet } from './submission-detail-sheet'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

type SubmissionsTableMode = 'active' | 'archive'

// Pinned to the company timezone by formatCalendarDate, so the tooltip is the
// same string on the server and in every browser (no hydration mismatch).
const RECEIVED_TITLE_STYLE = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const

const EMPTY_STATE_COPY: Record<SubmissionsTableMode, string> = {
  active: 'No submissions yet.',
  archive: 'No archived submissions.',
}

function describeSubmission(submission: FormSubmissionRecord): string {
  return (
    submission.contactName ||
    submission.contactEmail ||
    'this anonymous submission'
  )
}

type SubmissionsTableProps = {
  submissions: FormSubmissionRecord[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  mode: SubmissionsTableMode
  /** Base path pagination pushes to — '/submissions' or '/submissions/archive'. */
  basePath: string
  /**
   * Row resolved server-side from the `?submission=` share link. May not be
   * in `submissions` when it sits on another page or is filtered out.
   */
  deepLinkedSubmission?: FormSubmissionRecord | null
  /** True when the `?submission=` share link points at a row that no longer exists. */
  deepLinkNotFound?: boolean
}

export function SubmissionsTable({
  submissions,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  mode,
  basePath,
  deepLinkedSubmission,
  deepLinkNotFound,
}: SubmissionsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  // Selection by id, derived from fresh props: after router.refresh() the
  // open sheet re-renders with the server's latest row instead of a stale
  // snapshot. The shared hook owns the `?submission=` mirroring — local state
  // keeps the sheet opening and closing instantly while the URL catches up,
  // and back/forward is adopted during render.
  const {
    selectedValue: submissionParam,
    selectedId,
    select: selectSubmission,
    clear: clearSubmission,
  } = useSheetParamSelection('submission')
  const selected =
    submissions.find(submission => submission.id === selectedId) ??
    (deepLinkedSubmission && deepLinkedSubmission.id === selectedId
      ? deepLinkedSubmission
      : null)
  const [archiveTarget, setArchiveTarget] =
    useState<FormSubmissionRecord | null>(null)
  const [destroyTarget, setDestroyTarget] =
    useState<FormSubmissionRecord | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // The archive tab shows when each row was archived; active mode doesn't.
  const columnCount = mode === 'archive' ? 8 : 7

  // Sort changes route through useListParams so they reset offset paging
  // (PRD 004 §03); row-selection and page pushes keep the local helper.
  const { update: updateListParams, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isSubmissionSortValue(rawSort) ? rawSort : undefined

  // Run raw params through the type guards (R4): ?kind=bogus is ignored by
  // the server, so it must not count as an active filter — an unfiltered
  // empty list would otherwise show the wrong message. The unacknowledged
  // quick filter only exists on the active tab.
  const hasActiveFilter =
    (searchParams.get('q') ?? '').trim().length > 0 ||
    isFormSubmissionKind(searchParams.get('kind') ?? undefined) ||
    isFormSubmissionStatus(searchParams.get('status') ?? undefined) ||
    isContactFilterValue(searchParams.get('contact') ?? '') ||
    (mode === 'active' && searchParams.get('unacknowledged') === '1')

  const emptyMessage = hasActiveFilter
    ? 'No submissions match the current filters.'
    : EMPTY_STATE_COPY[mode]

  const updateParams = useCallback(
    (
      updates: Record<string, string | undefined>,
      options?: { scroll?: boolean; replace?: boolean }
    ) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }

      const navigate = options?.replace ? router.replace : router.push
      navigate(`${basePath}?${next.toString()}`, {
        scroll: options?.scroll ?? true,
      })
    },
    [basePath, router, searchParams]
  )

  const handleSelect = useCallback(
    (id: string) => {
      selectSubmission(id)
    },
    [selectSubmission]
  )

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // `clear` closes locally, then replaces the URL (shared convention)
        // so Back doesn't reopen the sheet.
        clearSubmission()
      }
    },
    [clearSubmission]
  )

  // After an action removes the last row of a page > 1, plain refresh would
  // strand the user on an empty out-of-range page — step back instead.
  const refreshAfterAction = useCallback(
    (removesRow: boolean) => {
      if (removesRow && submissions.length === 1 && currentPage > 1) {
        const previousPage = currentPage - 1
        // Also drop the share-link param: `searchParams` may still carry it
        // (sheet-close navigation in flight), and re-pushing it would reopen
        // the sheet for the removed row.
        updateParams(
          {
            page: previousPage === 1 ? undefined : String(previousPage),
            submission: undefined,
          },
          { scroll: false }
        )
        return
      }

      router.refresh()
    },
    [currentPage, router, submissions.length, updateParams]
  )

  const runRowAction = useCallback(
    (
      submission: FormSubmissionRecord,
      run: () => Promise<{ error?: string }>,
      errorTitle: string,
      removesRow: boolean
    ) => {
      setPendingId(submission.id)
      startTransition(async () => {
        const result = await run()

        setPendingId(null)

        if (result.error) {
          toast({
            title: errorTitle,
            description: result.error,
            variant: 'destructive',
          })
          // The row may have changed underneath us — show the latest.
          router.refresh()
          return
        }

        refreshAfterAction(removesRow)
      })
    },
    [refreshAfterAction, router, toast]
  )

  const handleAcknowledge = useCallback(
    (submission: FormSubmissionRecord) =>
      runRowAction(
        submission,
        () =>
          acknowledgeSubmission({
            id: submission.id,
            // Version token: the row as rendered (F3 stale-view guard).
            expectedLastActivityAt: submission.lastActivityAt,
          }),
        'Unable to acknowledge submission',
        // Acknowledging only removes the row when the unacknowledged
        // filter is narrowing the list.
        searchParams.get('unacknowledged') === '1'
      ),
    [runRowAction, searchParams]
  )

  const handleArchiveConfirm = useCallback(() => {
    if (!archiveTarget) {
      return
    }

    const target = archiveTarget
    setArchiveTarget(null)
    runRowAction(
      target,
      () => archiveSubmission({ id: target.id }),
      'Unable to archive submission',
      true
    )
  }, [archiveTarget, runRowAction])

  const handleRestore = useCallback(
    (submission: FormSubmissionRecord) =>
      runRowAction(
        submission,
        () => restoreSubmission({ id: submission.id }),
        'Unable to restore submission',
        true
      ),
    [runRowAction]
  )

  const handleDestroyConfirm = useCallback(() => {
    if (!destroyTarget) {
      return
    }

    const target = destroyTarget
    setDestroyTarget(null)
    runRowAction(
      target,
      () => destroySubmission({ id: target.id }),
      'Unable to permanently delete submission',
      true
    )
  }, [destroyTarget, runRowAction])

  return (
    <div className='space-y-4'>
      {deepLinkNotFound && submissionParam ? (
        <div
          role='status'
          className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
        >
          <span>
            The linked submission could not be found. It may have been
            permanently deleted.
          </span>
          <Button
            variant='ghost'
            size='sm'
            onClick={() =>
              updateParams({ submission: undefined }, { scroll: false })
            }
          >
            Dismiss
          </Button>
        </div>
      ) : null}
      <div className='overflow-hidden rounded-lg border'>
        {/* Fixed layout: the predictable columns (relative time, a badge,
            icon buttons) get pixel widths so they never bloat on wide
            screens, the text columns take a share of the table, and Contact
            — the only one without a width — absorbs whatever is left, so the
            sum can never push Actions off the edge. Below xl the Company
            column and the Source detail drop out (both are in the sheet) so
            the values that remain are readable at laptop widths, and the
            min width makes the container scroll instead of crushing columns
            when the window is narrower still. */}
        <Table density='compact' layout='fixed' className='min-w-[50rem]'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='received'
                sort={sort}
                defaultSort='received:desc'
                onSortChange={next => updateListParams({ sort: next })}
                className='w-40'
              >
                Received
              </SortableTableHead>
              <TableHead className='w-24'>Form</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className='hidden xl:table-cell xl:w-[12%]'>
                Company
              </TableHead>
              <TableHead className='w-[30%] xl:w-[22%]'>Outcome</TableHead>
              <TableHead className='w-24 xl:w-[18%]'>Source</TableHead>
              {mode === 'archive' ? (
                <TableHead className='w-32'>Archived</TableHead>
              ) : null}
              <TableHead className='w-24 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className='p-4'>
                  <EmptyState message={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : (
              submissions.map(submission => {
                const unacknowledged =
                  mode === 'active' && isUnacknowledgedSubmission(submission)
                const anonymous =
                  !submission.contactName && !submission.contactEmail
                const outcome = describeSubmissionOutcome(submission)
                const source = describeAttribution(submission)

                return (
                  <TableRow
                    key={submission.id}
                    {...getClickableRowProps(() => handleSelect(submission.id))}
                    className={cn(
                      CLICKABLE_ROW_CLASS,
                      unacknowledged && 'font-medium',
                      // Anonymous rows are mostly unfinished audits: keep
                      // them, but let identified visitors carry the page.
                      anonymous && 'text-muted-foreground',
                      submission.deletedAt && ARCHIVED_ROW_CLASS
                    )}
                  >
                    <TableCell
                      title={
                        formatCalendarDate(
                          submission.lastActivityAt,
                          RECEIVED_TITLE_STYLE
                        ) ?? undefined
                      }
                    >
                      {/* The unread dot lives in a fixed slot so the times
                          stay aligned whether or not a row is acknowledged. */}
                      <div className='flex items-center gap-2'>
                        <span
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            unacknowledged && 'bg-primary'
                          )}
                          aria-hidden='true'
                        />
                        {unacknowledged ? (
                          <span className='sr-only'>Unacknowledged</span>
                        ) : null}
                        <span className='truncate'>
                          {formatRelativeTime(submission.lastActivityAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant='outline'
                        className={cn(
                          FORM_SUBMISSION_KIND_TOKENS[submission.kind]
                        )}
                      >
                        {FORM_SUBMISSION_KIND_LABELS[submission.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {submission.contactName || submission.contactEmail ? (
                        // Single line so every row is the same height: the
                        // name truncates, the email collapses to a mailto
                        // icon (address in the tooltip) that never shrinks.
                        // The row click ignores anchors, so the icon doesn't
                        // also open the sheet.
                        <div className='flex min-w-0 items-center gap-1.5'>
                          <span className='min-w-0 truncate'>
                            {submission.contactName ?? submission.contactEmail}
                          </span>
                          {submission.contactEmail ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={`mailto:${submission.contactEmail}`}
                                  aria-label={`Email ${submission.contactEmail}`}
                                  className='text-muted-foreground hover:text-foreground shrink-0 transition'
                                >
                                  <Mail className='h-3.5 w-3.5' aria-hidden />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>
                                {submission.contactEmail}
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                      ) : (
                        <span className='text-muted-foreground italic'>
                          Anonymous
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className='hidden truncate xl:table-cell'
                      title={submission.contactCompany ?? undefined}
                    >
                      {submission.contactCompany ?? '—'}
                    </TableCell>
                    <TableCell>
                      {/* Single line so rows keep a uniform height: the
                          badge never shrinks, the detail truncates. */}
                      <div className='flex min-w-0 items-center gap-2'>
                        <Badge
                          variant='outline'
                          className={cn(
                            'shrink-0',
                            FORM_SUBMISSION_STATUS_TOKENS[submission.status]
                          )}
                        >
                          {FORM_SUBMISSION_STATUS_LABELS[submission.status]}
                        </Badge>
                        {outcome ? (
                          <span className='min-w-0 truncate' title={outcome}>
                            {outcome}
                          </span>
                        ) : null}
                        {submission.feedbackHelpful === true ? (
                          <ThumbsUp
                            className='text-success size-3.5 shrink-0'
                            aria-label='Found results helpful'
                          />
                        ) : submission.feedbackHelpful === false ? (
                          <ThumbsDown
                            className='text-destructive size-3.5 shrink-0'
                            aria-label='Did not find results helpful'
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className='flex min-w-0 items-center gap-2'
                        title={source.label}
                      >
                        <Badge
                          variant='outline'
                          className={cn(
                            'shrink-0',
                            ATTRIBUTION_CHANNEL_TOKENS[source.channel]
                          )}
                        >
                          {ATTRIBUTION_CHANNEL_LABELS[source.channel]}
                        </Badge>
                        {source.detail ? (
                          <span className='text-muted-foreground hidden min-w-0 truncate text-xs xl:inline'>
                            {source.detail}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    {mode === 'archive' ? (
                      <TableCell className='text-muted-foreground text-sm whitespace-nowrap'>
                        {submission.deletedAt
                          ? formatRelativeTime(submission.deletedAt)
                          : '—'}
                      </TableCell>
                    ) : null}
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        {unacknowledged ? (
                          <RowActionButton
                            label='Acknowledge submission'
                            icon={<Check />}
                            variant='outline'
                            disabled={pendingId === submission.id}
                            onClick={event => {
                              event.stopPropagation()
                              handleAcknowledge(submission)
                            }}
                          />
                        ) : null}
                        {mode === 'active' ? (
                          <RowActionButton
                            label='Archive submission'
                            icon={<Archive />}
                            variant='destructive'
                            disabled={pendingId === submission.id}
                            onClick={event => {
                              event.stopPropagation()
                              setArchiveTarget(submission)
                            }}
                          />
                        ) : (
                          <>
                            <RowActionButton
                              label='Restore submission'
                              icon={<RefreshCw />}
                              variant='outline'
                              disabled={pendingId === submission.id}
                              onClick={event => {
                                event.stopPropagation()
                                handleRestore(submission)
                              }}
                            />
                            <RowActionButton
                              label='Permanently delete submission'
                              icon={<Trash2 />}
                              variant='destructive'
                              disabled={pendingId === submission.id}
                              onClick={event => {
                                event.stopPropagation()
                                setDestroyTarget(submission)
                              }}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        mode='paged'
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={page =>
          updateParams({ page: page === 1 ? undefined : String(page) })
        }
      />

      <SubmissionArchiveDialog
        open={archiveTarget !== null}
        confirmDisabled={pendingId !== null}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={handleArchiveConfirm}
      />

      <ConfirmDialog
        open={destroyTarget !== null}
        title='Permanently delete submission?'
        description={
          destroyTarget
            ? `Permanently deleting the submission from ${describeSubmission(destroyTarget)} removes it and its history. This action cannot be undone.`
            : 'Permanently deleting this submission removes it and its history. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={pendingId !== null}
        onCancel={() => setDestroyTarget(null)}
        onConfirm={handleDestroyConfirm}
      />

      <SubmissionDetailSheet
        submission={selected}
        mode={mode}
        onRowRemoved={() => refreshAfterAction(true)}
        onOpenChange={handleSheetOpenChange}
      />
    </div>
  )
}
