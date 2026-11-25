'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { EmptyState } from '@placetostand/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@placetostand/ui/table'
import { useStartRefresh } from '@/components/layout/list-refresh'
import { DeepLinkNotFoundNotice } from '@/components/table/deep-link-not-found'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { toastLink, useToast } from '@/components/ui/use-toast'
import { feedbackRowState } from '@/lib/feedback/tokens'
import type { FeedbackReportRecord } from '@/lib/feedback/types'
import { PageSheetEntry } from '@/lib/sheets/page-sheet-entry'
import {
  useDeepLinkNotFound,
  useSheetParamSelection,
} from '@/lib/sheets/use-sheet-params'

import {
  acknowledgeFeedback,
  archiveFeedback,
  restoreFeedback,
  unacknowledgeFeedback,
} from '../actions'
import { FeedbackArchiveDialog } from './feedback-archive-dialog'
import { FeedbackSheet } from './feedback-sheet'
import { FeedbackTableRow } from './feedback-table-row'

type FeedbackTableProps = {
  reports: FeedbackReportRecord[]
  totalCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  mode: 'active' | 'archive'
  /** Where paging goes: the list, its archive or a project's tab. */
  basePath: string
  /** False on a project's tab: one project, so no Project column. */
  showProject?: boolean
  /**
   * True on the Feedback list, which renders the sheet itself. A project's
   * tab leaves it to the global sheet host.
   */
  ownsSheet?: boolean
  /** The report a `?feedback=` link names, when it isn't on this page. */
  deepLinkedReport?: FeedbackReportRecord | null
  deepLinkNotFound?: boolean
}

/** Feedback reports, newest first; a row opens the report's sheet. */
export function FeedbackTable({
  reports,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  mode,
  basePath,
  showProject = true,
  ownsSheet = false,
  deepLinkedReport,
  deepLinkNotFound,
}: FeedbackTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const startRefresh = useStartRefresh()
  const [archiveTarget, setArchiveTarget] =
    useState<FeedbackReportRecord | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const { selectedValue, selectedId, select, clear } =
    useSheetParamSelection('feedback')
  const showNotFound = useDeepLinkNotFound(
    'feedback',
    Boolean(deepLinkNotFound)
  )
  const selected =
    reports.find(report => report.id === selectedId) ??
    (deepLinkedReport && deepLinkedReport.id === selectedId
      ? deepLinkedReport
      : null)

  const goToPage = useCallback(
    (page: number, extra: Record<string, string | undefined> = {}) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries({
        page: page === 1 ? undefined : String(page),
        ...extra,
      })) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      startRefresh(() =>
        router.push(`${basePath}?${next.toString()}`, { scroll: false })
      )
    },
    [basePath, router, searchParams, startRefresh]
  )

  // An action that empties the last row of a later page steps back a page.
  const refreshAfterAction = useCallback(
    (removesRow: boolean) => {
      if (removesRow && reports.length === 1 && currentPage > 1) {
        goToPage(currentPage - 1, { feedback: undefined })
        return
      }
      router.refresh()
    },
    [currentPage, goToPage, reports.length, router]
  )

  const runRowAction = useCallback(
    (
      report: FeedbackReportRecord,
      action: (input: { id: string }) => Promise<{ error?: string }>,
      errorTitle: string,
      removesRow: boolean
    ) => {
      setPendingId(report.id)
      startTransition(async () => {
        const result = await action({ id: report.id })
        setPendingId(null)
        if (result.error) {
          toast({
            title: errorTitle,
            description: result.error,
            variant: 'destructive',
            link: toastLink('feedback', report.id),
          })
          router.refresh()
          return
        }
        refreshAfterAction(removesRow)
      })
    },
    [refreshAfterAction, router, toast]
  )

  const filtered =
    (searchParams.get('q') ?? '').trim().length > 0 ||
    searchParams.has('type') ||
    searchParams.has('state')
  const emptyMessage = filtered
    ? 'No reports match the current filters.'
    : mode === 'archive'
      ? 'No archived reports.'
      : 'No feedback yet.'
  const columnCount = (showProject ? 7 : 6) + (mode === 'archive' ? 1 : 0)

  return (
    <div className='space-y-4'>
      {showNotFound && selectedValue ? (
        <DeepLinkNotFoundNotice entity='report' onDismiss={clear} />
      ) : null}
      <div className='overflow-hidden rounded-lg border'>
        {/* Fixed layout: the short columns get widths, Message takes the
            rest. On a phone the rows stack, led by the message. */}
        <Table
          density='compact'
          layout='fixed'
          stack
          className='md:min-w-[48rem]'
        >
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead className='w-[13%]'>Received</TableHead>
              <TableHead className='w-24'>Type</TableHead>
              <TableHead>Message</TableHead>
              {showProject ? (
                <TableHead className='hidden w-[16%] lg:table-cell'>
                  Project
                </TableHead>
              ) : null}
              <TableHead className='w-[15%]'>From</TableHead>
              <TableHead className='w-24'>State</TableHead>
              {mode === 'archive' ? (
                <TableHead className='w-[12%]'>Archived</TableHead>
              ) : null}
              <TableHead className='w-20 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className='p-4'>
                  <EmptyState message={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : (
              reports.map(report => {
                const unread =
                  mode === 'active' && feedbackRowState(report) === 'new'
                return (
                  <FeedbackTableRow
                    key={report.id}
                    report={report}
                    mode={mode}
                    showProject={showProject}
                    pending={pendingId === report.id}
                    onOpen={() => select(report.id)}
                    onArchive={() => setArchiveTarget(report)}
                    onRestore={() =>
                      runRowAction(
                        report,
                        restoreFeedback,
                        'Unable to restore the report',
                        true
                      )
                    }
                    onToggleSeen={() =>
                      runRowAction(
                        report,
                        unread ? acknowledgeFeedback : unacknowledgeFeedback,
                        unread
                          ? 'Unable to mark the report as seen'
                          : 'Unable to mark the report as new',
                        searchParams.get('state') === 'new'
                      )
                    }
                  />
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
        onPageChange={page => goToPage(page)}
      />

      <FeedbackArchiveDialog
        open={archiveTarget !== null}
        confirmDisabled={pendingId !== null}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (!archiveTarget) return
          const target = archiveTarget
          setArchiveTarget(null)
          runRowAction(
            target,
            archiveFeedback,
            'Unable to archive the report',
            true
          )
        }}
      />

      {ownsSheet ? (
        <PageSheetEntry entity='feedback'>
          <FeedbackSheet
            report={selected}
            onRowRemoved={() => refreshAfterAction(true)}
            onOpenChange={open => {
              if (!open) clear()
            }}
          />
        </PageSheetEntry>
      ) : null}
    </div>
  )
}
