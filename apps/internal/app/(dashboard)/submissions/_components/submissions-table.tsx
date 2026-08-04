'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Archive, Check, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  FORM_SUBMISSION_KIND_LABELS,
  FORM_SUBMISSION_KIND_TOKENS,
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_SUBMISSION_STATUS_TOKENS,
  isUnreadSubmission,
} from '@/lib/form-submissions/constants'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'
import {
  acknowledgeSubmission,
  archiveSubmission,
  restoreSubmission,
} from '../actions'

import { SubmissionArchiveDialog } from './submission-archive-dialog'
import { SubmissionDetailSheet } from './submission-detail-sheet'

export type SubmissionsTableMode = 'active' | 'archive'

const EMPTY_STATE_COPY: Record<SubmissionsTableMode, string> = {
  active: 'No submissions yet.',
  archive: 'No archived submissions.',
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
}

export function SubmissionsTable({
  submissions,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  mode,
  basePath,
}: SubmissionsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [selected, setSelected] = useState<FormSubmissionRecord | null>(null)
  const [archiveTarget, setArchiveTarget] =
    useState<FormSubmissionRecord | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // The archive tab shows when each row was archived; active mode doesn't.
  const columnCount = mode === 'archive' ? 10 : 9

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }

      router.push(`${basePath}?${next.toString()}`)
    },
    [basePath, router, searchParams]
  )

  const runRowAction = useCallback(
    (
      submission: FormSubmissionRecord,
      action: (input: { id: string }) => Promise<{ error?: string }>,
      errorTitle: string
    ) => {
      setPendingId(submission.id)
      startTransition(async () => {
        const result = await action({ id: submission.id })

        setPendingId(null)

        if (result.error) {
          toast({
            title: errorTitle,
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        router.refresh()
      })
    },
    [router, toast]
  )

  const handleAcknowledge = useCallback(
    (submission: FormSubmissionRecord) =>
      runRowAction(
        submission,
        acknowledgeSubmission,
        'Unable to acknowledge submission'
      ),
    [runRowAction]
  )

  const handleArchiveConfirm = useCallback(() => {
    if (!archiveTarget) {
      return
    }

    const target = archiveTarget
    setArchiveTarget(null)
    runRowAction(target, archiveSubmission, 'Unable to archive submission')
  }, [archiveTarget, runRowAction])

  const handleRestore = useCallback(
    (submission: FormSubmissionRecord) =>
      runRowAction(
        submission,
        restoreSubmission,
        'Unable to restore submission'
      ),
    [runRowAction]
  )

  return (
    <div className='space-y-4'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-6'>
              <span className='sr-only'>Unread</span>
            </TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Form</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Phase</TableHead>
            {mode === 'archive' ? <TableHead>Archived</TableHead> : null}
            <TableHead className='text-right'>
              <span className='sr-only'>Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className='text-muted-foreground py-10 text-center'
              >
                {EMPTY_STATE_COPY[mode]}
              </TableCell>
            </TableRow>
          ) : (
            submissions.map(submission => {
              const unread =
                mode === 'active' && isUnreadSubmission(submission)

              return (
                <TableRow
                  key={submission.id}
                  onClick={() => setSelected(submission)}
                  className={cn('cursor-pointer', unread && 'font-medium')}
                >
                  <TableCell className='w-6'>
                    {unread ? (
                      <span
                        className='bg-primary block size-2 rounded-full'
                        aria-hidden='true'
                      />
                    ) : null}
                    {unread ? <span className='sr-only'>Unread</span> : null}
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {formatDistanceToNow(new Date(submission.lastActivityAt), {
                      addSuffix: true,
                    })}
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
                      <div className='flex flex-col'>
                        <span>{submission.contactName ?? '—'}</span>
                        <span className='text-muted-foreground text-xs'>
                          {submission.contactEmail}
                        </span>
                      </div>
                    ) : (
                      <span className='text-muted-foreground italic'>
                        Anonymous
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{submission.contactCompany ?? '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant='outline'
                      className={cn(
                        FORM_SUBMISSION_STATUS_TOKENS[submission.status]
                      )}
                    >
                      {FORM_SUBMISSION_STATUS_LABELS[submission.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {submission.percentComplete === null ? (
                      <span className='text-muted-foreground'>—</span>
                    ) : (
                      <div className='flex items-center gap-2'>
                        <Progress
                          value={submission.percentComplete}
                          className='w-16'
                        />
                        <span className='text-muted-foreground text-xs'>
                          {submission.percentComplete}%
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {submission.result?.phaseName ??
                      submission.phaseId ?? (
                        <span className='text-muted-foreground'>—</span>
                      )}
                  </TableCell>
                  {mode === 'archive' ? (
                    <TableCell className='text-muted-foreground whitespace-nowrap text-sm'>
                      {submission.deletedAt
                        ? formatDistanceToNow(new Date(submission.deletedAt), {
                            addSuffix: true,
                          })
                        : '—'}
                    </TableCell>
                  ) : null}
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      {unread ? (
                        <Button
                          variant='outline'
                          size='icon'
                          title='Acknowledge submission'
                          aria-label='Acknowledge submission'
                          disabled={pendingId === submission.id}
                          onClick={event => {
                            event.stopPropagation()
                            handleAcknowledge(submission)
                          }}
                        >
                          <Check className='h-4 w-4' />
                          <span className='sr-only'>Acknowledge</span>
                        </Button>
                      ) : null}
                      {mode === 'active' ? (
                        <Button
                          variant='destructive'
                          size='icon'
                          title='Archive submission'
                          aria-label='Archive submission'
                          disabled={pendingId === submission.id}
                          onClick={event => {
                            event.stopPropagation()
                            setArchiveTarget(submission)
                          }}
                        >
                          <Archive className='h-4 w-4' />
                          <span className='sr-only'>Archive</span>
                        </Button>
                      ) : (
                        <Button
                          variant='secondary'
                          size='icon'
                          title='Restore submission'
                          aria-label='Restore submission'
                          disabled={pendingId === submission.id}
                          onClick={event => {
                            event.stopPropagation()
                            handleRestore(submission)
                          }}
                        >
                          <RefreshCw className='h-4 w-4' />
                          <span className='sr-only'>Restore</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
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
      )}

      <SubmissionArchiveDialog
        open={archiveTarget !== null}
        confirmDisabled={pendingId !== null}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={handleArchiveConfirm}
      />

      <SubmissionDetailSheet
        submission={selected}
        mode={mode}
        onOpenChange={open => {
          if (!open) {
            setSelected(null)
          }
        }}
      />
    </div>
  )
}
