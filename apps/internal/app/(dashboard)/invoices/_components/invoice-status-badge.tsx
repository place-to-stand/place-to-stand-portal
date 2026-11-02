import { Badge } from '@pts/ui/badge'
import { INVOICE_STATUS_TINTS, statusTint } from '@pts/ui/status-tints'

import { cn } from '@/lib/utils'

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  PAID: 'Paid',
  VOID: 'Void',
}

/** The tint for an invoice status, for the chip and the status filter. */
export function invoiceStatusTint(status: string): string {
  return statusTint(INVOICE_STATUS_TINTS, status)
}

/** The invoice status chip, shared by the invoices table and the invoice sheet. */
export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant='outline' className={cn(invoiceStatusTint(status))}>
      {INVOICE_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
