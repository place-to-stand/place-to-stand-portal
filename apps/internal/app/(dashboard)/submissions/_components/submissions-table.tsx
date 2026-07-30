'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  FORM_SUBMISSION_KIND_LABELS,
  FORM_SUBMISSION_KIND_TOKENS,
  FORM_SUBMISSION_KIND_VALUES,
  FORM_SUBMISSION_STATUS_LABELS,
  FORM_SUBMISSION_STATUS_TOKENS,
  FORM_SUBMISSION_STATUS_VALUES,
  type FormSubmissionKind,
  type FormSubmissionStatus,
} from '@/lib/form-submissions/constants'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'

import { SubmissionDetailSheet } from './submission-detail-sheet'

const ALL = 'all'

type SubmissionsTableProps = {
  submissions: FormSubmissionRecord[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  activeKind?: FormSubmissionKind
  activeStatus?: FormSubmissionStatus
}

export function SubmissionsTable({
  submissions,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  activeKind,
  activeStatus,
}: SubmissionsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<FormSubmissionRecord | null>(null)

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

      router.push(`/submissions?${next.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          <Select
            value={activeKind ?? ALL}
            onValueChange={value =>
              // Filters reset to page 1 - staying on page 7 of a smaller
              // result set would render an empty table.
              updateParams({
                kind: value === ALL ? undefined : value,
                page: undefined,
              })
            }
          >
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder='All forms' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All forms</SelectItem>
              {FORM_SUBMISSION_KIND_VALUES.map(kind => (
                <SelectItem key={kind} value={kind}>
                  {FORM_SUBMISSION_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={activeStatus ?? ALL}
            onValueChange={value =>
              updateParams({
                status: value === ALL ? undefined : value,
                page: undefined,
              })
            }
          >
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='All statuses' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {FORM_SUBMISSION_STATUS_VALUES.map(status => (
                <SelectItem key={status} value={status}>
                  {FORM_SUBMISSION_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className='text-muted-foreground text-sm whitespace-nowrap'>
          Total submissions: {totalCount}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Received</TableHead>
            <TableHead>Form</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Phase</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className='text-muted-foreground py-10 text-center'
              >
                No submissions yet.
              </TableCell>
            </TableRow>
          ) : (
            submissions.map(submission => (
              <TableRow
                key={submission.id}
                onClick={() => setSelected(submission)}
                className='cursor-pointer'
              >
                <TableCell className='whitespace-nowrap'>
                  {formatDistanceToNow(new Date(submission.lastActivityAt), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>
                  <Badge
                    variant='outline'
                    className={cn(FORM_SUBMISSION_KIND_TOKENS[submission.kind])}
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
              </TableRow>
            ))
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

      <SubmissionDetailSheet
        submission={selected}
        onOpenChange={open => {
          if (!open) {
            setSelected(null)
          }
        }}
      />
    </div>
  )
}
