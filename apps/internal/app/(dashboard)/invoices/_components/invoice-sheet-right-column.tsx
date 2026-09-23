'use client'

import { useState, useCallback } from 'react'
import { Ban, Calendar, Eye, Hash, Send, Undo2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Separator } from '@pts/ui/separator'
import type { InvoiceWithClient } from '@/lib/invoices/invoice-form'
import { formatCalendarDate } from '@pts/ui/dates'

import { InvoiceShareSection } from './invoice-share-section'
import { InvoiceStatusBadge } from './invoice-status-badge'

type InvoiceSheetRightColumnProps = {
  invoice: InvoiceWithClient
  isPending: boolean
  onSendInvoice: () => void
  onUnsendInvoice: () => void
  onVoidInvoice: () => void
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const formatDate = (dateStr: string | null): string | null =>
  formatCalendarDate(dateStr)

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
  // Track local optimistic override; null means "use prop value"
  const [shareOverride, setShareOverride] = useState<boolean | null>(null)
  const shareActive = shareOverride ?? invoice.share_enabled

  const handleShareStateChange = useCallback((enabled: boolean) => {
    setShareOverride(enabled)
  }, [])

  const canSend = invoice.status === 'DRAFT' && shareActive
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
        {showSendButton || showUnsendButton || canVoid ? (
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
                      className='w-full justify-start'
                      onClick={onSendInvoice}
                      disabled={isPending || !canSend}
                    >
                      <Send className='text-success' />
                      Mark as sent
                    </Button>
                  </DisabledFieldTooltip>
                ) : null}
                {showUnsendButton ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='w-full justify-start'
                    onClick={onUnsendInvoice}
                    disabled={isPending}
                  >
                    <Undo2 className='text-warning' />
                    Revert to draft
                  </Button>
                ) : null}
                {canVoid ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='w-full justify-start'
                    onClick={onVoidInvoice}
                    disabled={isPending}
                  >
                    <Ban className='text-destructive' />
                    Void invoice
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
              <InvoiceStatusBadge status={invoice.status} />
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
