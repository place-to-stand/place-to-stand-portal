import { Badge } from '@pts/ui/badge'
import { BADGE_TINTS } from '@pts/ui/badge-tints'

import { cn } from '@/lib/utils'

const INVOICE_STATUS_BADGES: Record<string, { label: string; tint: string }> = {
  DRAFT: { label: 'Draft', tint: BADGE_TINTS.neutral },
  SENT: { label: 'Sent', tint: BADGE_TINTS.blue },
  VIEWED: { label: 'Viewed', tint: BADGE_TINTS.amber },
  PAID: { label: 'Paid', tint: BADGE_TINTS.emerald },
  VOID: { label: 'Void', tint: BADGE_TINTS.rose },
}

/** The tint for an invoice status, for the chip and the status filter. */
export function invoiceStatusTint(status: string): string {
  return INVOICE_STATUS_BADGES[status]?.tint ?? BADGE_TINTS.neutral
}

/** The invoice status chip, shared by the invoices table and the invoice sheet. */
export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant='outline' className={cn(invoiceStatusTint(status))}>
      {INVOICE_STATUS_BADGES[status]?.label ?? status}
    </Badge>
  )
}
