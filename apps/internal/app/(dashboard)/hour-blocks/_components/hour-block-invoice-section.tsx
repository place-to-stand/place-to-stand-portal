'use client'

import { EmptyState } from '@pts/ui/empty-state'
import { Separator } from '@pts/ui/separator'
import { InvoiceRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { SheetSection } from '@/components/sheets/sheet-section'
import type { HourBlockWithClient } from '@/lib/settings/hour-blocks/hour-block-form'

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
          <SheetRecordList>
            <InvoiceRecordRow
              invoice={{
                id: invoiceId,
                number: hourBlock.invoice_number,
                status: hourBlock.invoice_status,
                total: hourBlock.invoice_total,
                issuedDate: hourBlock.invoice_issued_date,
              }}
            />
          </SheetRecordList>
        ) : (
          <EmptyState message='No invoice.' />
        )}
      </SheetSection>
    </>
  )
}
