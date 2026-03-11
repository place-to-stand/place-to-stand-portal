'use client'

import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Archive,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { InvoiceWithClient } from '@/lib/invoices/invoice-form'

export type InvoicesTableMode = 'active' | 'archive'

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
  emptyMessage: string
}

const NON_EDITABLE_STATUSES = new Set(['PAID'])

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

const formatDate = (value: string | null) => {
  if (!value) return '\u2014'
  try {
    return format(new Date(value), 'MMM d, yyyy')
  } catch (error) {
    console.warn('Unable to format invoice date', { value, error })
    return '\u2014'
  }
}

function StatusBadge({ status, dueDate }: { status: string; dueDate: string | null }) {
  const isOverdue =
    dueDate &&
    (status === 'SENT' || status === 'VIEWED') &&
    new Date(dueDate) < new Date()

  return (
    <div className='flex items-center gap-1.5'>
      {status === 'DRAFT' ? (
        <Badge variant='secondary' className='text-xs'>
          Draft
        </Badge>
      ) : status === 'SENT' ? (
        <Badge variant='default' className='text-xs'>
          Sent
        </Badge>
      ) : status === 'VIEWED' ? (
        <Badge
          variant='outline'
          className='border-transparent bg-amber-100 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        >
          Viewed
        </Badge>
      ) : status === 'PAID' ? (
        <Badge
          variant='outline'
          className='border-transparent bg-emerald-100 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
        >
          Paid
        </Badge>
      ) : status === 'VOID' ? (
        <Badge variant='destructive' className='text-xs'>
          Void
        </Badge>
      ) : (
        <Badge variant='secondary' className='text-xs'>
          {status}
        </Badge>
      )}
      {isOverdue ? (
        <Badge variant='destructive' className='text-xs'>
          Overdue
        </Badge>
      ) : null}
    </div>
  )
}

function ShareLinkCell({ invoice }: { invoice: InvoiceWithClient }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!invoice.share_token) return
    const url = `${window.location.origin}/share/invoices/${invoice.share_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [invoice.share_token])

  if (!invoice.share_enabled || !invoice.share_token) {
    return <span className='text-muted-foreground text-sm'>{'\u2014'}</span>
  }

  const truncatedPath = `/share/invoices/${invoice.share_token.slice(0, 8)}...`

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/invoices/${invoice.share_token}`

  return (
    <div className='flex items-center gap-1.5'>
      <span className='text-muted-foreground truncate text-xs font-mono'>
        {truncatedPath}
      </span>
      <Button
        variant='ghost'
        size='icon'
        className='h-6 w-6 flex-shrink-0'
        onClick={handleCopy}
        title='Copy share link'
      >
        {copied ? (
          <Check className='h-3 w-3 text-green-600' />
        ) : (
          <Copy className='h-3 w-3' />
        )}
      </Button>
      <Button
        variant='ghost'
        size='icon'
        className='h-6 w-6 flex-shrink-0'
        onClick={() => window.open(shareUrl, '_blank')}
        title='Open share link'
      >
        <ExternalLink className='h-3 w-3' />
      </Button>
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
  emptyMessage,
}: InvoicesTableSectionProps) {
  return (
    <div className='overflow-hidden rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead>Invoice #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>Share Link</TableHead>
            <TableHead className='w-28 text-right'>Actions</TableHead>
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

            const showEdit = mode === 'active' && !NON_EDITABLE_STATUSES.has(invoice.status)
            const showArchive = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

            const editDisabled = isBusy
            const archiveDisabled = isBusy || isArchived
            const restoreDisabled = isBusy || !isArchived
            const destroyDisabled = isBusy || !isArchived

            const editDisabledReason = editDisabled ? pendingReason : null

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
                className={isArchived ? 'opacity-60' : undefined}
              >
                <TableCell className='text-sm font-medium'>
                  {invoice.invoice_number ? (
                    invoice.invoice_number
                  ) : (
                    <Badge variant='secondary' className='text-xs'>
                      Draft
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-2 text-sm'>
                    <Building2 className='text-muted-foreground h-4 w-4' />
                    <span>{client ? client.name : 'Unassigned'}</span>
                  </div>
                  {client?.deleted_at ? (
                    <p className='text-destructive text-xs'>Client archived</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <StatusBadge status={invoice.status} dueDate={invoice.due_date} />
                </TableCell>
                <TableCell className='text-sm'>
                  {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {invoice.issued_date ? (
                    <>
                      {formatDate(invoice.issued_date)}
                      {invoice.due_date ? (
                        <span className='text-muted-foreground/70'>
                          {' '}(due {formatDate(invoice.due_date)})
                        </span>
                      ) : null}
                    </>
                  ) : (
                    '\u2014'
                  )}
                </TableCell>
                <TableCell>
                  <ShareLinkCell invoice={invoice} />
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {showEdit ? (
                      <DisabledFieldTooltip
                        disabled={editDisabled}
                        reason={editDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => onEdit(invoice)}
                          title='Edit invoice'
                          disabled={editDisabled}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showArchive ? (
                      <DisabledFieldTooltip
                        disabled={archiveDisabled}
                        reason={archiveDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => onRequestDelete(invoice)}
                          title='Archive invoice'
                          aria-label='Archive invoice'
                          disabled={archiveDisabled}
                        >
                          <Archive className='h-4 w-4' />
                          <span className='sr-only'>Archive</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <Button
                          variant='secondary'
                          size='icon'
                          onClick={() => onRestore(invoice)}
                          title='Restore invoice'
                          aria-label='Restore invoice'
                          disabled={restoreDisabled}
                        >
                          <RefreshCw className='h-4 w-4' />
                          <span className='sr-only'>Restore</span>
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
                          size='icon'
                          onClick={() => onRequestDestroy(invoice)}
                          title='Permanently delete invoice'
                          aria-label='Permanently delete invoice'
                          disabled={destroyDisabled}
                        >
                          <Trash2 className='h-4 w-4' />
                          <span className='sr-only'>Delete permanently</span>
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
              <TableCell
                colSpan={7}
                className='text-muted-foreground py-10 text-center text-sm'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
