'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  Archive,
  Building2,
  Check,
  Copy,
  Eye,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
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
  onSendInvoice: (invoiceId: string) => void
  onRefresh: () => void
  emptyMessage: string
}

const NON_EDITABLE_STATUSES = new Set(['PAID', 'VOID'])

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

function BillingTypeBadge() {
  return (
    <Badge
      variant='outline'
      className='border-transparent bg-amber-100 text-[10px] px-1.5 py-0 leading-4 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
    >
      Net 30
    </Badge>
  )
}

function ShareLinkCell({
  invoice,
  onSendInvoice,
  onRefresh,
}: {
  invoice: InvoiceWithClient
  onSendInvoice: (invoiceId: string) => void
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSendPrompt, setShowSendPrompt] = useState(false)

  const handleCopy = useCallback(() => {
    if (!invoice.share_token) return
    const url = `${window.location.origin}/share/invoices/${invoice.share_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [invoice.share_token])

  const handleGenerateLink = useCallback(async () => {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.ok) {
        toast({
          title: 'Sharing enabled',
          description: 'The invoice link is ready to share.',
        })
        if (invoice.status === 'DRAFT') {
          // Show dialog before refreshing — refresh would unmount the dialog
          setShowSendPrompt(true)
        } else {
          onRefresh()
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to generate link',
          description: data.error ?? 'Please try again.',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to generate link',
        description: 'Network error. Please check your connection.',
      })
    } finally {
      setIsGenerating(false)
    }
  }, [invoice.id, invoice.status, toast, onRefresh])

  const handleConfirmSend = useCallback(() => {
    setShowSendPrompt(false)
    onSendInvoice(invoice.id)
    onRefresh()
  }, [invoice.id, onSendInvoice, onRefresh])

  const handleDeclineSend = useCallback(() => {
    setShowSendPrompt(false)
    onRefresh()
  }, [onRefresh])

  if (!invoice.share_enabled || !invoice.share_token) {
    return (
      <>
        <ConfirmDialog
          open={showSendPrompt}
          title='Mark invoice as sent?'
          description='The invoice must be marked as sent before the client can make a payment. Would you like to mark it as sent now?'
          confirmLabel='Mark as Sent'
          cancelLabel='Not Now'
          onConfirm={handleConfirmSend}
          onCancel={handleDeclineSend}
        />
        <Button
          size='sm'
          className='h-7 gap-1.5 px-3 text-xs'
          onClick={handleGenerateLink}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className='h-3 w-3 animate-spin' />
          ) : (
            <Link2 className='h-3 w-3' />
          )}
          {isGenerating ? 'Generating...' : 'Generate Shareable Link'}
        </Button>
      </>
    )
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
  onSendInvoice,
  onRefresh,
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

            const isViewOnly = NON_EDITABLE_STATUSES.has(invoice.status)
            const showEditOrView = mode === 'active'
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
                  <div className='flex items-center gap-2 text-sm'>
                    <Building2 className='text-muted-foreground h-4 w-4' />
                    {client ? (
                      client.slug ? (
                        <Link
                          href={`/clients/${client.slug}`}
                          className='hover:text-foreground hover:underline'
                        >
                          {client.name}
                        </Link>
                      ) : (
                        <span>{client.name}</span>
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
                  <ShareLinkCell
                    invoice={invoice}
                    onSendInvoice={onSendInvoice}
                    onRefresh={onRefresh}
                  />
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {showEditOrView ? (
                      isViewOnly ? (
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => onEdit(invoice)}
                          title='View invoice'
                        >
                          <Eye className='h-4 w-4' />
                        </Button>
                      ) : (
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
                      )
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
