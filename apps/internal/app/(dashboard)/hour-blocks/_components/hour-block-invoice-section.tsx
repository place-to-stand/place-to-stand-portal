'use client'

import { Separator } from '@pts/ui/separator'
import { InvoiceRecordRow } from '@/components/sheets/entity-record-rows'
import { EntityList } from '@/components/sheets/entity-list'
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
      <EntityList
        title='Linked invoice'
        description={
          invoiceId
            ? undefined
            : 'Blocks created from a paid invoice link to it automatically.'
        }
        isEmpty={!invoiceId}
        emptyMessage='No invoice.'
      >
        {invoiceId ? (
          <InvoiceRecordRow
            invoice={{
              id: invoiceId,
              number: hourBlock.invoice_number,
              status: hourBlock.invoice_status,
              total: hourBlock.invoice_total,
              issuedDate: hourBlock.invoice_issued_date,
            }}
          />
        ) : null}
      </EntityList>
    </>
  )
}
