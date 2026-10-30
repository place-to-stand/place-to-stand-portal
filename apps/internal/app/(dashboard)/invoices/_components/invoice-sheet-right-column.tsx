'use client'

import { Ban, Calendar, CheckCheck, Eye, Mail, Undo2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Separator } from '@pts/ui/separator'
import type { InvoiceWithClient } from '@/lib/invoices/invoice-form'
import { formatCalendarDate } from '@pts/ui/dates'

import { HourBlockRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { InvoiceLinkField } from './invoice-link-field'
import { InvoiceStatusBadge } from './invoice-status-badge'

type InvoiceSheetRightColumnProps = {
  invoice: InvoiceWithClient
  isPending: boolean
  /**
   * The form has unsaved edits: sending is blocked until Save, so a client
   * never receives an invoice that differs from what is on screen.
   */
  hasUnsavedChanges: boolean
  /** Opens the send dialog: emails the invoice (and marks a draft sent). */
  onEmailInvoice: () => void
  /** "Mark as sent": for an invoice delivered some other way. */
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
const RESENDABLE_STATUSES = new Set(['SENT', 'VIEWED'])

const ACTION_CLASS = 'w-full justify-start'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceSheetRightColumn({
  invoice,
  isPending,
  hasUnsavedChanges,
  onEmailInvoice,
  onSendInvoice,
  onUnsendInvoice,
  onVoidInvoice,
}: InvoiceSheetRightColumnProps) {
  const isDraft = invoice.status === 'DRAFT'
  const canVoid = VOIDABLE_STATUSES.has(invoice.status)
  const canEmailAgain = RESENDABLE_STATUSES.has(invoice.status)
  const canRevert = invoice.status === 'SENT'
  // Live exactly while sent; a draft has no public link to show.
  const liveToken =
    !isDraft && invoice.share_enabled ? invoice.share_token : null
  const hasActions = isDraft || canEmailAgain || canRevert || canVoid

  return (
    <div className='bg-muted/20 flex-shrink-0 max-lg:border-t lg:w-96 lg:overflow-y-auto'>
      <div className='space-y-6 p-6'>
        {/* A draft reserves the link's space; sending fills it in. */}
        {liveToken || isDraft ? (
          <>
            <InvoiceLinkField invoiceId={invoice.id} shareToken={liveToken} />
            <Separator />
          </>
        ) : null}

        {hasActions ? (
          <>
            <div className='space-y-4'>
              <span className='mb-2 block text-sm font-medium'>Actions</span>
              {hasUnsavedChanges && (isDraft || canEmailAgain) ? (
                <p
                  className='text-muted-foreground -mt-1 mb-2 text-sm'
                  data-testid='invoice-send-blocked'
                >
                  Save your changes before sending.
                </p>
              ) : null}
              <div className='flex flex-col gap-2'>
                {isDraft || canEmailAgain ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className={ACTION_CLASS}
                    onClick={onEmailInvoice}
                    disabled={isPending || hasUnsavedChanges}
                  >
                    <Mail className='text-success' />
                    {isDraft ? 'Send to client' : 'Email again'}
                  </Button>
                ) : null}
                {isDraft ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className={ACTION_CLASS}
                    onClick={onSendInvoice}
                    disabled={isPending || hasUnsavedChanges}
                  >
                    <CheckCheck className='text-success' />
                    Mark as sent
                  </Button>
                ) : null}
                {canRevert ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className={ACTION_CLASS}
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
                    className={ACTION_CLASS}
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
                <span className='text-muted-foreground text-sm'>Invoice #</span>
                <span className='text-sm font-medium'>
                  {invoice.invoice_number}
                </span>
              </div>
            ) : null}
            {invoice.hour_blocks?.length ? (
              <div className='space-y-2 pt-1'>
                <span className='text-muted-foreground block text-sm'>
                  Hour blocks
                </span>
                <SheetRecordList>
                  {invoice.hour_blocks.map(block => (
                    <HourBlockRecordRow
                      key={block.id}
                      hourBlock={{
                        id: block.id,
                        name: block.description,
                        hours: block.hours_purchased,
                        amount: block.amount,
                      }}
                    />
                  ))}
                </SheetRecordList>
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
