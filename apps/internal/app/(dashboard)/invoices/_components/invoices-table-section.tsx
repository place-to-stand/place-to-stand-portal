'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { formatCalendarDate } from '@pts/ui/dates'
import {
  Archive,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Mail,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { BADGE_TINTS } from '@pts/ui/badge-tints'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
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
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { InvoiceWithClient } from '@/lib/invoices/invoice-form'
import { invoiceShareHref } from '@/lib/invoices/links'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

import { InvoiceEmailDialog } from './invoice-email-dialog'
import { InvoiceHourBlocksCell } from './invoice-hour-blocks-cell'
import { InvoiceStatusBadge } from './invoice-status-badge'

type InvoicesTableMode = 'active' | 'archive'

export type InvoicesTableSectionProps = {
  invoices: InvoiceWithClient[]
  mode: InvoicesTableMode
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  onEdit: (invoice: InvoiceWithClient) => void
  onRequestDelete: (invoice: InvoiceWithClient) => void
  onRestore: (invoice: InvoiceWithClient) => void
  onRequestDestroy: (invoice: InvoiceWithClient) => void
  onRefresh: () => void
  emptyMessage: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

const formatCurrency = (value: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value))
  } catch {
    return value
  }
}

const formatDate = (value: string | null) =>
  formatCalendarDate(value) ?? '\u2014'

function BillingTypeBadge() {
  return (
    <Badge
      variant='outline'
      className={cn(BADGE_TINTS.amber, 'px-1.5 py-0 text-[10px] leading-4')}
    >
      Net 30
    </Badge>
  )
}

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
      })
      onRefresh()
    },
    [toast, onRefresh]
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
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
  mode,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
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

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table density='compact' layout='fixed'>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='number'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
              className='w-[12%]'
            >
              Invoice #
            </SortableTableHead>
            {/* Unsized on purpose: in a fixed layout the one auto column
                absorbs the slack, so Actions stays at its own width. */}
            <SortableTableHead
              field='client'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
            >
              Client
            </SortableTableHead>
            <TableHead className='w-20'>Status</TableHead>
            <TableHead className='w-[10%]'>Total</TableHead>
            <TableHead className='w-20'>Hours</TableHead>
            <SortableTableHead
              field='created'
              sort={sort}
              defaultSort='created:desc'
              onSortChange={next => update({ sort: next })}
              className='w-[14%]'
            >
              Issued
            </SortableTableHead>
            <TableHead className='w-[22%]'>Share link</TableHead>
            {/* Sized to the row's buttons: one in active, two in archive. */}
            <TableHead
              className={cn(
                'text-right',
                mode === 'archive' ? 'w-24' : 'w-16'
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
            const isDestroying = isPending && pendingDestroyId === invoice.id
            const isBusy = isDeleting || isRestoring || isDestroying

            const showArchive = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

            const archiveDisabled = isBusy || isArchived
            const restoreDisabled = isBusy || !isArchived
            const destroyDisabled = isBusy || !isArchived

            const archiveDisabledReason = archiveDisabled
              ? isArchived
                ? 'Invoice already archived.'
                : pendingReason
              : null

            const restoreDisabledReason = restoreDisabled
              ? isArchived
                ? pendingReason
                : 'Invoice is already active.'
              : null

            const destroyDisabledReason = destroyDisabled
              ? !isArchived
                ? 'Archive the invoice before permanently deleting.'
                : pendingReason
              : null

            return (
              <TableRow
                key={invoice.id}
                {...getClickableRowProps(() => onEdit(invoice))}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  isArchived && ARCHIVED_ROW_CLASS
                )}
              >
                <TableCell className='text-sm font-medium'>
                  <div className='flex items-center gap-2'>
                    {invoice.invoice_number ? (
                      invoice.invoice_number
                    ) : (
                      <Badge variant='secondary' className='text-xs'>
                        Draft
                      </Badge>
                    )}
                    {invoice.billing_type === 'net_30' ? (
                      <BillingTypeBadge />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex min-w-0 items-center gap-2 text-sm'>
                    <Building2 className='text-muted-foreground h-4 w-4 shrink-0' />
                    {client ? (
                      client.slug ? (
                        <Link
                          href={`/clients/${client.slug}`}
                          className='hover:text-foreground truncate-link hover:underline'
                        >
                          {client.name}
                        </Link>
                      ) : (
                        <span className='truncate'>{client.name}</span>
                      )
                    ) : (
                      <span>Unassigned</span>
                    )}
                  </div>
                  {client?.deleted_at ? (
                    <p className='text-destructive text-xs'>Client archived</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className='text-sm'>
                  {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell>
                  <InvoiceHourBlocksCell
                    hourBlocks={invoice.hour_blocks ?? []}
                    invoiceNumber={invoice.invoice_number}
                  />
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {formatDate(invoice.issued_date)}
                </TableCell>
                <TableCell>
                  <ShareLinkCell invoice={invoice} onRefresh={onRefresh} />
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {showArchive ? (
                      <DisabledFieldTooltip
                        disabled={archiveDisabled}
                        reason={archiveDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon-sm'
                          onClick={() => onRequestDelete(invoice)}
                          aria-label='Archive invoice'
                          disabled={archiveDisabled}
                        >
                          <Archive />
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon-sm'
                          onClick={() => onRestore(invoice)}
                          aria-label='Restore invoice'
                          disabled={restoreDisabled}
                        >
                          <RefreshCw />
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showDestroy ? (
                      <DisabledFieldTooltip
                        disabled={destroyDisabled}
                        reason={destroyDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon-sm'
                          onClick={() => onRequestDestroy(invoice)}
                          aria-label='Permanently delete invoice'
                          disabled={destroyDisabled}
                        >
                          <Trash2 />
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {invoiceList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className='p-4'>
                <EmptyState message={emptyMessage} />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
