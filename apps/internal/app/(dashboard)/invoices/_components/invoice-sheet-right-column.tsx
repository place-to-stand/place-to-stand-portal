'use client'

import { Calendar, Eye } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Separator } from '@pts/ui/separator'

import { EntityList } from '@/components/sheets/entity-list'
import { SheetSection } from '@/components/sheets/sheet-section'
import type { InvoiceWithClient } from '@/lib/invoices/invoice-form'
import { formatCalendarDate } from '@pts/ui/dates'

import { HourBlockRecordRow } from '@/components/sheets/entity-record-rows'
import { SHEET_SIDE_COLUMN_CLASS } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  INVOICE_ACTION_ICONS,
  invoiceStatusActionLabel,
  invoiceStatusActions,
  type InvoiceStatusAction,
} from '../_lib/use-invoice-status-actions'
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
  /** Starts a status action (`useInvoiceStatusActions`). */
  onAction: (action: InvoiceStatusAction) => void
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const formatDate = (dateStr: string | null): string | null =>
  formatCalendarDate(dateStr)

// ---------------------------------------------------------------------------
// Status-aware action buttons
// ---------------------------------------------------------------------------

const ACTION_CLASS = 'w-full justify-start'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceSheetRightColumn({
  invoice,
  isPending,
  hasUnsavedChanges,
  onAction,
}: InvoiceSheetRightColumnProps) {
  const isDraft = invoice.status === 'DRAFT'
  const actions = invoiceStatusActions(invoice.status)
  // Live exactly while sent; a draft has no public link to show.
  const liveToken =
    !isDraft && invoice.share_enabled ? invoice.share_token : null
  const hasActions = actions.length > 0

  return (
    <div
      className={cn(
        'bg-muted/20 flex-shrink-0 max-lg:border-t lg:overflow-y-auto',
        SHEET_SIDE_COLUMN_CLASS
      )}
    >
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
              {hasUnsavedChanges && actions.includes('email') ? (
                <p
                  className='text-muted-foreground -mt-1 mb-2 text-sm'
                  data-testid='invoice-send-blocked'
                >
                  Save your changes before sending.
                </p>
              ) : null}
              <div className='flex flex-col gap-2'>
                {actions.map(action => (
                  <Button
                    key={action}
                    type='button'
                    variant='outline'
                    size='sm'
                    className={ACTION_CLASS}
                    onClick={() => onAction(action)}
                    disabled={
                      isPending ||
                      // Sending waits for Save, so a client never receives
                      // an invoice that differs from what is on screen.
                      ((action === 'email' || action === 'send') &&
                        hasUnsavedChanges)
                    }
                  >
                    {INVOICE_ACTION_ICONS[action]}
                    {invoiceStatusActionLabel(action, invoice.status)}
                  </Button>
                ))}
              </div>
            </div>
            <Separator />
          </>
        ) : null}

        {/* The hour blocks this invoice bought */}
        {invoice.hour_blocks?.length ? (
          <>
            <EntityList
              title={
                invoice.hour_blocks.length === 1
                  ? 'Linked hour block'
                  : 'Linked hour blocks'
              }
              isEmpty={false}
              emptyMessage=''
            >
              {invoice.hour_blocks.map(block => (
                <HourBlockRecordRow
                  key={block.id}
                  hourBlock={{
                    id: block.id,
                    name: block.description,
                    hours: block.hours_purchased,
                  }}
                />
              ))}
            </EntityList>
            <Separator />
          </>
        ) : null}

        {/* Status & Invoice Number */}
        <SheetSection>
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
          </div>
        </SheetSection>

        <Separator />

        {/* Key Dates */}
        <SheetSection title='Dates'>
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
        </SheetSection>

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
