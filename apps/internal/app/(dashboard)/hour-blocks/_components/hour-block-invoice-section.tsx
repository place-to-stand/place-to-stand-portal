'use client'

import Link from 'next/link'

import { Button } from '@pts/ui/button'
import { formatCalendarDate } from '@pts/ui/dates'
import { Separator } from '@pts/ui/separator'
import { LinkedRecordCard } from '@/components/sheets/linked-record-card'
import { SheetSection } from '@/components/sheets/sheet-section'
import type { HourBlockWithClient } from '@/lib/settings/hour-blocks/hour-block-form'
import { invoiceHref } from '@/lib/sheets/hrefs'

import { InvoiceStatusBadge } from '../../invoices/_components/invoice-status-badge'
import { ENTITY_ICONS } from '@/lib/entity-accents'

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/**
 * The invoice a block was created from, read-only. The link is set by the
 * paid-invoice webhook and can't be changed or cleared from the sheet.
 */
export function HourBlockInvoiceSection({
  hourBlock,
}: {
  hourBlock: HourBlockWithClient
}) {
  const invoiceId = hourBlock.invoice_id

  return (
    <>
      <Separator />
      <SheetSection
        title='Invoice'
        description={
          invoiceId
            ? undefined
            : 'Blocks created from a paid invoice link to it automatically.'
        }
      >
        {invoiceId ? (
          <LinkedRecordCard
            icon={ENTITY_ICONS.invoice}
            title={hourBlock.invoice_number ?? 'Invoice'}
            details={[
              {
                label: 'Status',
                value: hourBlock.invoice_status ? (
                  <InvoiceStatusBadge status={hourBlock.invoice_status} />
                ) : (
                  '—'
                ),
              },
              {
                label: 'Total',
                value:
                  hourBlock.invoice_total === null
                    ? '—'
                    : USD.format(hourBlock.invoice_total),
              },
              {
                label: 'Issued',
                value: hourBlock.invoice_issued_date
                  ? formatCalendarDate(hourBlock.invoice_issued_date)
                  : '—',
              },
            ]}
            action={
              <Button variant='outline' size='sm' asChild>
                <Link href={invoiceHref(invoiceId)}>
                  <ENTITY_ICONS.invoice />
                  Open invoice
                </Link>
              </Button>
            }
          />
        ) : (
          <LinkedRecordCard icon={ENTITY_ICONS.invoice} title='No invoice' />
        )}
      </SheetSection>
    </>
  )
}
