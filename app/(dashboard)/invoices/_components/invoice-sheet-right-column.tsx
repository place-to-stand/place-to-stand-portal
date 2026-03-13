'use client'

import { useState, useCallback, useEffect } from 'react'
import { Ban, Calendar, Eye, Hash, Send, Undo2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Separator } from '@/components/ui/separator'
import type { InvoiceWithClient } from '@/lib/invoices/invoice-form'

import { InvoiceShareSection } from './invoice-share-section'

type InvoiceSheetRightColumnProps = {
  invoice: InvoiceWithClient
  isPending: boolean
  onSendInvoice: () => void
  onUnsendInvoice: () => void
  onVoidInvoice: () => void
}

// ---------------------------------------------------------------------------
// Status badge (matches the table section badge styling)
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'DRAFT') {
    return (
      <Badge variant='secondary' className='text-xs'>
        Draft
      </Badge>
    )
  }
  if (status === 'SENT') {
    return (
      <Badge variant='default' className='text-xs'>
        Sent
      </Badge>
    )
  }
  if (status === 'VIEWED') {
    return (
      <Badge
        variant='outline'
        className='border-transparent bg-amber-100 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
      >
        Viewed
      </Badge>
    )
  }
  if (status === 'PAID') {
    return (
      <Badge
        variant='outline'
        className='border-transparent bg-emerald-100 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      >
        Paid
      </Badge>
    )
  }
  if (status === 'VOID') {
    return (
      <Badge variant='destructive' className='text-xs'>
        Void
      </Badge>
    )
  }
  return (
    <Badge variant='secondary' className='text-xs'>
      {status}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

const formatDate = (dateStr: string | null): string | null => {
  if (!dateStr) return null
  // For date-only strings (e.g. "2026-03-10"), append T00:00:00 to prevent
  // timezone shifts. Full timestamps (e.g. "2026-03-10 15:30:00+00") parse fine.
  const d = new Date(DATE_ONLY_RE.test(dateStr) ? `${dateStr}T00:00:00` : dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Status-aware action buttons
// ---------------------------------------------------------------------------

const VOIDABLE_STATUSES = new Set(['DRAFT', 'SENT', 'VIEWED'])

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceSheetRightColumn({
  invoice,
  isPending,
  onSendInvoice,
  onUnsendInvoice,
  onVoidInvoice,
}: InvoiceSheetRightColumnProps) {
  const [shareActive, setShareActive] = useState(invoice.share_enabled)

  // Sync local share state when the invoice prop updates (e.g. after send/unsend)
  useEffect(() => {
    setShareActive(invoice.share_enabled)
  }, [invoice.share_enabled])

  const handleShareStateChange = useCallback((enabled: boolean) => {
    setShareActive(enabled)
  }, [])

  const canSend = invoice.status === 'DRAFT' && shareActive
  const canUnsend = invoice.status === 'SENT'
  const canVoid = VOIDABLE_STATUSES.has(invoice.status)
  const showSendButton = invoice.status === 'DRAFT'
  const showUnsendButton = invoice.status === 'SENT'

  return (
    <div className='bg-muted/20 w-80 flex-shrink-0 overflow-y-auto lg:w-96'>
      <div className='space-y-6 p-6'>
        {/* Share Link (inline) */}
        <InvoiceShareSection
          invoiceId={invoice.id}
          shareToken={invoice.share_token}
          shareEnabled={invoice.share_enabled}
          invoiceStatus={invoice.status}
          onShareStateChange={handleShareStateChange}
          onSendInvoice={onSendInvoice}
        />

        <Separator />

        {/* Actions */}
        {(showSendButton || showUnsendButton || canVoid) ? (
          <>
            <div className='space-y-4'>
              <span className='mb-2 block text-sm font-medium'>Actions</span>
              <div className='flex flex-col gap-2'>
                {showSendButton ? (
                  <DisabledFieldTooltip
                    disabled={!canSend}
                    reason={!canSend ? 'Generate a shareable link first' : null}
                  >
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='w-full justify-start gap-2'
                      onClick={onSendInvoice}
                      disabled={isPending || !canSend}
                    >
                      <Send className='h-4 w-4 text-green-500' />
                      Mark as Sent
                    </Button>
                  </DisabledFieldTooltip>
                ) : null}
                {showUnsendButton ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='w-full justify-start gap-2'
                    onClick={onUnsendInvoice}
                    disabled={isPending}
                  >
                    <Undo2 className='h-4 w-4 text-amber-500' />
                    Revert to Draft
                  </Button>
                ) : null}
                {canVoid ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='w-full justify-start gap-2'
                    onClick={onVoidInvoice}
                    disabled={isPending}
                  >
                    <Ban className='h-4 w-4 text-red-500' />
                    Void Invoice
                  </Button>
                ) : null}
              </div>
            </div>
            <Separator />
          </>
        ) : null}

        {/* Status & Invoice Number */}
        <div className='space-y-4'>
          <span className='mb-2 block text-sm font-medium'>Details</span>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>Status</span>
              <StatusBadge status={invoice.status} />
            </div>
            {invoice.invoice_number ? (
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                  <Hash className='h-3.5 w-3.5' />
                  Invoice #
                </span>
                <span className='mb-2 block text-sm font-medium'>
                  {invoice.invoice_number}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <Separator />

        {/* Key Dates */}
        <div className='space-y-4'>
          <span className='mb-2 block text-sm font-medium'>Dates</span>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                <Calendar className='h-3.5 w-3.5' />
                Created
              </span>
              <span className='text-sm'>
                {formatDate(invoice.created_at) ?? '--'}
              </span>
            </div>
            {invoice.issued_date ? (
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                  <Calendar className='h-3.5 w-3.5' />
                  Issued
                </span>
                <span className='text-sm'>
                  {formatDate(invoice.issued_date)}
                </span>
              </div>
            ) : null}
            {invoice.paid_at ? (
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                  <Calendar className='h-3.5 w-3.5' />
                  Paid
                </span>
                <span className='text-sm'>{formatDate(invoice.paid_at)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* View Count */}
        {invoice.share_enabled && invoice.viewed_count > 0 ? (
          <>
            <Separator />
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <Eye className='h-4 w-4' />
              Viewed {invoice.viewed_count} time
              {invoice.viewed_count !== 1 ? 's' : ''}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
