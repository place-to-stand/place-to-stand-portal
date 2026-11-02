'use client'

import Link from 'next/link'
import { Info } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { EmptyValue } from '@/components/table/empty-value'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { formatCalendarDate } from '@pts/ui/dates'
import { formatHours } from '@pts/ui/numbers'
import { companySheetHref, invoiceHref } from '@/lib/sheets/hrefs'
import { isHourBlockSortValue } from '@/lib/settings/hour-blocks/filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import type { HourBlockWithClient } from '@/lib/settings/hour-blocks/hour-block-form'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

type HourBlocksTableMode = 'active' | 'archive'

export type HourBlocksTableSectionProps = {
  hourBlocks: HourBlockWithClient[]
  mode: HourBlocksTableMode
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  onEdit: (block: HourBlockWithClient) => void
  onRequestDelete: (block: HourBlockWithClient) => void
  onRestore: (block: HourBlockWithClient) => void
  emptyMessage: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

const formatTimestamp = (value: string) =>
  formatCalendarDate(value) ?? <EmptyValue />

export function HourBlocksTableSection({
  hourBlocks,
  mode,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  onEdit,
  onRequestDelete,
  onRestore,
  emptyMessage,
  basePath,
}: HourBlocksTableSectionProps) {
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isHourBlockSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table
        density='compact'
        layout='fixed'
        stack
        className='md:min-w-[42rem]'
      >
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='hours'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
              className='w-[18%]'
            >
              Hours purchased
            </SortableTableHead>
            <SortableTableHead
              field='client'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
              className='w-[34%]'
            >
              Client
            </SortableTableHead>
            <SortableTableHead
              field='invoice'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
              className='w-[18%]'
            >
              Invoice #
            </SortableTableHead>
            <SortableTableHead
              field='created'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
              className='w-[18%]'
            >
              Created on
            </SortableTableHead>
            <TableHead className='w-24 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hourBlocks.map(block => {
            const client = block.client
            const isArchived = Boolean(block.deleted_at)
            const isDeleting = isPending && pendingDeleteId === block.id
            const isRestoring = isPending && pendingRestoreId === block.id

            const showArchive = mode === 'active'
            const showRestore = mode === 'archive'

            const archiveDisabled = isDeleting || isRestoring || isArchived
            const restoreDisabled = isRestoring || isDeleting || !isArchived

            const archiveDisabledReason = archiveDisabled
              ? isArchived
                ? 'Hour block already archived.'
                : pendingReason
              : null

            const restoreDisabledReason = restoreDisabled
              ? isArchived
                ? pendingReason
                : 'Hour block is already active.'
              : null

            return (
              <TableRow
                key={block.id}
                {...getClickableRowProps(() => onEdit(block))}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  isArchived && ARCHIVED_ROW_CLASS
                )}
              >
                <TableCell label='Hours' className='text-sm'>
                  <span className='inline-flex items-center gap-2'>
                    <ENTITY_ICONS.hourBlock
                      className={cn(
                        ENTITY_ACCENTS.hourBlock.icon,
                        'h-4 w-4 shrink-0'
                      )}
                    />
                    {formatHours(block.hours_purchased)}
                    {block.notes ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className='cursor-default'
                            aria-label='Hour block notes'
                          >
                            <Info className='text-muted-foreground h-3.5 w-3.5' />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className='max-w-xs whitespace-pre-wrap'>
                          {block.notes}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>
                  <div className='flex min-w-0 items-center gap-2 text-sm'>
                    <ENTITY_ICONS.client
                      className={cn(
                        ENTITY_ACCENTS.client.icon,
                        'h-4 w-4 shrink-0'
                      )}
                    />
                    {client ? (
                      // Opens the client; the row ignores clicks on links.
                      <Link
                        href={companySheetHref(client.company_id)}
                        title={client.name}
                        className='hover:text-foreground truncate underline-offset-4 transition hover:underline'
                      >
                        {client.name}
                      </Link>
                    ) : (
                      <EmptyValue />
                    )}
                  </div>
                  {client?.deleted_at ? (
                    <p className='text-destructive text-xs'>Client archived</p>
                  ) : null}
                </TableCell>
                <TableCell label='Invoice' className='text-sm'>
                  {block.invoice_number ? (
                    <div className='flex min-w-0 items-center gap-2'>
                      <ENTITY_ICONS.invoice
                        className={cn(
                          ENTITY_ACCENTS.invoice.icon,
                          'h-4 w-4 shrink-0'
                        )}
                      />
                      {block.invoice_id ? (
                        <Link
                          href={invoiceHref(block.invoice_id)}
                          className='text-muted-foreground hover:text-foreground truncate hover:underline'
                        >
                          {block.invoice_number}
                        </Link>
                      ) : (
                        <span className='text-muted-foreground truncate'>
                          {block.invoice_number}
                        </span>
                      )}
                    </div>
                  ) : (
                    <EmptyValue />
                  )}
                </TableCell>
                <TableCell
                  label='Created'
                  className='text-muted-foreground text-sm'
                >
                  {formatTimestamp(block.created_at)}
                </TableCell>
                <TableCell className='text-right max-md:ml-auto'>
                  <RecordRowActions>
                    {showRestore ? (
                      <RecordRowAction
                        kind='restore'
                        entity='hour block'
                        onClick={() => onRestore(block)}
                        disabled={restoreDisabled}
                        disabledReason={restoreDisabledReason}
                      />
                    ) : null}
                    {showArchive ? (
                      <RecordRowAction
                        kind='archive'
                        entity='hour block'
                        onClick={() => onRequestDelete(block)}
                        disabled={archiveDisabled}
                        disabledReason={archiveDisabledReason}
                      />
                    ) : null}
                  </RecordRowActions>
                </TableCell>
              </TableRow>
            )
          })}
          {hourBlocks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className='p-4'>
                <EmptyState message={emptyMessage} />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
