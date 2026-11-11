'use client'

import { useState, useCallback } from 'react'
import { formatCalendarDate } from '@pts/ui/dates'
import { formatCurrency } from '@pts/ui/numbers'
import { Check, Copy, ExternalLink, Loader2, Mail } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { RecordContextMenu } from '@/components/table/record-context-menu'
import { EmptyValue } from '@/components/table/empty-value'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { isInvoiceSortValue } from '@/lib/invoices/filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { toastLink, useToast } from '@/components/ui/use-toast'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { cn } from '@/lib/utils'
import type { InvoiceWithClient } from '@/lib/invoices/invoice-form'
import { invoiceShareHref } from '@/lib/invoices/links'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

import {
  INVOICE_ACTION_ICONS,
  invoiceStatusActionLabel,
  invoiceStatusActions,
  useInvoiceStatusActions,
} from '../_lib/use-invoice-status-actions'

import { InvoiceEmailDialog } from './invoice-email-dialog'
import { InvoiceHourBlocksCell } from './invoice-hour-blocks-cell'
import { InvoiceStatusBadge } from './invoice-status-badge'
import {
  RowSelectionProvider,
  SelectAllHead,
  SelectRowCell,
  type RowSelection,
} from '@/components/table/bulk-select'
import { SheetLink } from '@/components/ui/sheet-link'

type InvoicesTableMode = 'active' | 'archive'

export type InvoicesTableSectionProps = {
  invoices: InvoiceWithClient[]
  selection: RowSelection
  mode: InvoicesTableMode
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  onEdit: (invoice: InvoiceWithClient) => void
  onRequestDelete: (invoice: InvoiceWithClient) => void
  onRestore: (invoice: InvoiceWithClient) => void
  onRefresh: () => void
  emptyMessage: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

const formatDate = (value: string | null) =>
  formatCalendarDate(value) ?? '\u2014'

/**
 * A draft has no public link yet, so its cell is the way to send it; from
 * then on the cell is the live link.
 */
function ShareLinkCell({
  invoice,
  onRefresh,
}: {
  invoice: InvoiceWithClient
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)

  const handleSent = useCallback(
    ({ invoiceNumber }: { invoiceNumber: string }) => {
      setSendOpen(false)
      toast({
        title: 'Invoice sent',
        description: `Invoice ${invoiceNumber} was emailed and marked as sent.`,
        link: toastLink('invoice', invoice.id),
      })
      onRefresh()
    },
    [invoice.id, toast, onRefresh]
  )

  if (invoice.status === 'DRAFT') {
    return (
      <>
        <Button size='xs' variant='outline' onClick={() => setSendOpen(true)}>
          <Mail />
          Send
        </Button>
        <InvoiceEmailDialog
          invoiceId={invoice.id}
          open={sendOpen}
          onOpenChange={setSendOpen}
          onSent={handleSent}
        />
      </>
    )
  }

  if (!invoice.share_enabled || !invoice.share_token) {
    return <span className='text-muted-foreground text-sm'>{'\u2014'}</span>
  }

  const path = invoiceShareHref(invoice.share_token)
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${path}`
  const truncatedPath = `${path.slice(0, path.length - invoice.share_token.length)}${invoice.share_token.slice(0, 8)}...`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      // Refused (permissions, insecure page): show no "Copied" tick.
      () => setCopied(false)
    )
  }

  return (
    <div className='flex min-w-0 items-center gap-1.5'>
      <span className='text-muted-foreground min-w-0 truncate font-mono text-xs'>
        {truncatedPath}
      </span>
      <RowActionButton
        label='Copy share link'
        icon={copied ? <Check className='text-success' /> : <Copy />}
        className='flex-shrink-0'
        onClick={handleCopy}
      />
      <RowActionButton
        label='Open share link'
        icon={<ExternalLink />}
        className='flex-shrink-0'
        onClick={() => window.open(shareUrl, '_blank')}
      />
    </div>
  )
}

export function InvoicesTableSection({
  invoices: invoiceList,
  selection,
  mode,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  onEdit,
  onRequestDelete,
  onRestore,
  onRefresh,
  emptyMessage,
  basePath,
}: InvoicesTableSectionProps) {
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isInvoiceSortValue(rawSort) ? rawSort : undefined
  // The same sortable headers as Companies and the other lists.
  const sortHead = (
    field: string,
    label: string,
    className: string,
    align?: 'right'
  ) => (
    <SortableTableHead
      field={field}
      sort={sort}
      defaultSort='created:desc'
      onSortChange={next => update({ sort: next })}
      className={className}
      align={align}
    >
      {label}
    </SortableTableHead>
  )
  // The same send, mark sent, revert and void the invoice sheet runs.
  const statusActions = useInvoiceStatusActions({
    linkHint: 'Copy the public link from the Share link column.',
  })

  return (
    <div className='overflow-hidden rounded-lg border'>
      <RowSelectionProvider selection={selection} entity='invoice'>
        <Table
          density='compact'
          layout='fixed'
          stack
          className='md:min-w-[60rem]'
        >
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SelectAllHead />
              {/* Wide enough for the icon and INV-0000 (or Draft) at the
                  60rem floor, with room for a fifth digit. */}
              {sortHead('number', 'Invoice #', 'w-[12%]')}
              {/* Unsized on purpose: in a fixed layout the one auto column
                absorbs the slack, so Actions stays at its own width. */}
              {sortHead('client', 'Client', '')}
              {sortHead('status', 'Status', 'w-[8%]')}
              {sortHead('total', 'Total', 'w-[10%]', 'right')}
              {/* p-0 plus the button's px-2: pl-2 lines the label up with
                  the cells' md:pl-4, clear of the right-aligned Total. */}
              {sortHead('hours', 'Hours', 'w-[9%] pl-2')}
              {sortHead('created', 'Issued', 'w-[11%]')}
              {sortHead('share', 'Share link', 'w-[15%]')}
              {/* Sized to the row's buttons: up to three status actions
                  (send, mark sent or revert, void), or Restore on the
                  Archive tab. Archive itself is in the right-click menu and
                  the bulk bar. */}
              <TableHead
                className={cn(
                  'text-right',
                  mode === 'archive' ? 'w-20' : 'w-32'
                )}
              >
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoiceList.map(invoice => {
              const client = invoice.client
              const isArchived = Boolean(invoice.deleted_at)
              const isDeleting = isPending && pendingDeleteId === invoice.id
              const isRestoring = isPending && pendingRestoreId === invoice.id
              const isBusy = isDeleting || isRestoring

              const showArchive = mode === 'active'
              const showRestore = mode === 'archive'

              const isPaid = invoice.status === 'PAID'
              const archiveDisabled = isBusy || isArchived || isPaid
              const restoreDisabled = isBusy || !isArchived

              const archiveDisabledReason = archiveDisabled
                ? isArchived
                  ? 'Invoice already archived.'
                  : isPaid
                    ? 'Paid invoices cannot be archived.'
                    : pendingReason
                : null

              const restoreDisabledReason = restoreDisabled
                ? isArchived
                  ? pendingReason
                  : 'Invoice is already active.'
                : null

              return (
                <RecordContextMenu
                  key={invoice.id}
                  entity='invoice'
                  id={invoice.id}
                  onEdit={() => onEdit(invoice)}
                  onArchive={
                    showArchive && !isPaid
                      ? () => onRequestDelete(invoice)
                      : undefined
                  }
                  onRestore={showRestore ? () => onRestore(invoice) : undefined}
                  archiveDisabledReason={
                    showRestore ? restoreDisabledReason : archiveDisabledReason
                  }
                >
                  <TableRow
                    {...getClickableRowProps(() => onEdit(invoice))}
                    data-selected={
                      selection.isSelected(invoice.id) || undefined
                    }
                    className={cn(
                      CLICKABLE_ROW_CLASS,
                      isArchived && ARCHIVED_ROW_CLASS
                    )}
                  >
                    <SelectRowCell
                      id={invoice.id}
                      label={invoice.invoice_number ?? 'draft invoice'}
                    />
                    <TableCell className='text-sm font-medium'>
                      <div className='flex items-center gap-2'>
                        <ENTITY_ICONS.invoice
                          aria-hidden
                          className={cn(
                            'h-4 w-4 shrink-0',
                            ENTITY_ACCENTS.invoice.icon
                          )}
                        />
                        {invoice.invoice_number ? (
                          invoice.invoice_number
                        ) : (
                          <Badge variant='secondary'>Draft</Badge>
                        )}
                      </div>
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
                          client.company_id ? (
                            <SheetLink
                              sheet={{
                                entity: 'company',
                                id: client.company_id,
                              }}
                              title={client.name}
                            >
                              {client.name}
                            </SheetLink>
                          ) : (
                            <span className='truncate'>{client.name}</span>
                          )
                        ) : (
                          <EmptyValue />
                        )}
                      </div>
                      {client?.deleted_at ? (
                        <p className='text-destructive text-xs'>
                          Client archived
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className='text-right text-sm tabular-nums'>
                      {formatCurrency(invoice.total)}
                    </TableCell>
                    <TableCell label='Hours' className='md:pl-4'>
                      <InvoiceHourBlocksCell
                        hourBlocks={invoice.hour_blocks ?? []}
                      />
                    </TableCell>
                    <TableCell
                      label='Issued'
                      className='text-muted-foreground text-sm'
                    >
                      {formatDate(invoice.issued_date)}
                    </TableCell>
                    <TableCell label='Share link'>
                      <ShareLinkCell invoice={invoice} onRefresh={onRefresh} />
                    </TableCell>
                    <TableCell className='text-right max-md:ml-auto'>
                      <RecordRowActions>
                        {showRestore ? (
                          <RecordRowAction
                            kind='restore'
                            entity='invoice'
                            onClick={() => onRestore(invoice)}
                            disabled={restoreDisabled}
                            disabledReason={restoreDisabledReason}
                          />
                        ) : (
                          invoiceStatusActions(invoice.status).map(action => (
                            <RowActionButton
                              key={action}
                              type='button'
                              variant='outline'
                              label={invoiceStatusActionLabel(
                                action,
                                invoice.status
                              )}
                              icon={
                                statusActions.pendingId === invoice.id ? (
                                  <Loader2 className='animate-spin' />
                                ) : (
                                  INVOICE_ACTION_ICONS[action]
                                )
                              }
                              disabled={statusActions.pendingId !== null}
                              onClick={event => {
                                // Rows open their invoice on click.
                                event.stopPropagation()
                                statusActions.request(action, invoice.id)
                              }}
                            />
                          ))
                        )}
                      </RecordRowActions>
                    </TableCell>
                  </TableRow>
                </RecordContextMenu>
              )
            })}
            {invoiceList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className='p-4'>
                  <EmptyState message={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </RowSelectionProvider>
      {statusActions.dialogs}
    </div>
  )
}
