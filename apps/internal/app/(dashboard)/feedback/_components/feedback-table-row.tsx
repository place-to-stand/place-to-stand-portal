'use client'

import { Badge } from '@placetostand/ui/badge'
import { formatCalendarDate, formatRelativeTime } from '@placetostand/ui/dates'
import { TableCell, TableRow } from '@placetostand/ui/table'
import { EmptyValue } from '@/components/table/empty-value'
import { RecordContextMenu } from '@/components/table/record-context-menu'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { FEEDBACK_TYPE_LABELS } from '@/lib/feedback/constants'
import {
  FEEDBACK_STATE_LABELS,
  FEEDBACK_STATE_TOKENS,
  FEEDBACK_TYPE_TOKENS,
  feedbackRowState,
} from '@/lib/feedback/tokens'
import type { FeedbackReportRecord } from '@/lib/feedback/types'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { UNREAD_ROW_CLASS } from '@/lib/table/unread-row'
import { cn } from '@/lib/utils'

const RECEIVED_TITLE_STYLE = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const

/** One report in the Feedback table; a click opens its sheet. */
export function FeedbackTableRow({
  report,
  mode,
  showProject,
  pending,
  onOpen,
  onArchive,
  onRestore,
  onToggleSeen,
}: {
  report: FeedbackReportRecord
  mode: 'active' | 'archive'
  showProject: boolean
  pending: boolean
  onOpen: () => void
  onArchive: () => void
  onRestore: () => void
  /** Mark as seen, or back to new. */
  onToggleSeen: () => void
}) {
  const state = feedbackRowState(report)
  const unread = mode === 'active' && state === 'new'
  return (
    <RecordContextMenu
      entity='feedback'
      id={report.id}
      onEdit={onOpen}
      onArchive={mode === 'active' ? onArchive : undefined}
      onRestore={mode === 'archive' ? onRestore : undefined}
      pending={pending}
    >
      <TableRow
        {...getClickableRowProps(onOpen)}
        className={cn(
          CLICKABLE_ROW_CLASS,
          unread && UNREAD_ROW_CLASS,
          state === 'spam' && 'text-muted-foreground',
          report.deletedAt && ARCHIVED_ROW_CLASS
        )}
      >
        <TableCell
          className='max-md:first-cell:basis-auto'
          title={
            formatCalendarDate(report.createdAt, RECEIVED_TITLE_STYLE) ??
            undefined
          }
        >
          <span className='block truncate'>
            {formatRelativeTime(report.createdAt)}
          </span>
        </TableCell>
        <TableCell>
          <Badge
            variant='outline'
            className={FEEDBACK_TYPE_TOKENS[report.type]}
          >
            {FEEDBACK_TYPE_LABELS[report.type]}
          </Badge>
        </TableCell>
        <TableCell className='max-md:order-first max-md:basis-full'>
          <span className='block truncate' title={report.message}>
            {report.message}
          </span>
        </TableCell>
        {showProject ? (
          <TableCell
            className='hidden truncate lg:table-cell'
            title={report.projectName}
          >
            {report.projectName}
          </TableCell>
        ) : null}
        <TableCell className='truncate'>
          {report.reporterName ?? report.reporterEmail ?? <EmptyValue />}
        </TableCell>
        <TableCell>
          <Badge variant='outline' className={FEEDBACK_STATE_TOKENS[state]}>
            {FEEDBACK_STATE_LABELS[state]}
          </Badge>
        </TableCell>
        {mode === 'archive' ? (
          <TableCell
            label='Archived'
            className='text-muted-foreground text-sm whitespace-nowrap'
          >
            {report.deletedAt ? (
              formatRelativeTime(report.deletedAt)
            ) : (
              <EmptyValue />
            )}
          </TableCell>
        ) : null}
        <TableCell className='text-right max-md:ml-auto'>
          <RecordRowActions>
            {mode === 'active' && (state === 'new' || state === 'seen') ? (
              <RecordRowAction
                kind={unread ? 'acknowledge' : 'unacknowledge'}
                entity='report'
                disabled={pending}
                onClick={onToggleSeen}
              />
            ) : null}
            {mode === 'archive' ? (
              <RecordRowAction
                kind='restore'
                entity='report'
                disabled={pending}
                onClick={onRestore}
              />
            ) : null}
          </RecordRowActions>
        </TableCell>
      </TableRow>
    </RecordContextMenu>
  )
}
