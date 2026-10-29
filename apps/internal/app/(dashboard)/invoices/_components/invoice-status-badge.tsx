import { Receipt } from 'lucide-react'

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
    <Badge
      variant='outline'
      className={cn('text-xs', invoiceStatusTint(status))}
    >
      {INVOICE_STATUS_BADGES[status]?.label ?? status}
    </Badge>
  )
}

// The status badge's ink, for the invoice icon. Written out in full so
// Tailwind's scanner sees them.
const INVOICE_STATUS_ICON: Record<string, string> = {
  DRAFT: 'text-muted-foreground',
  SENT: 'text-blue-600 dark:text-blue-300',
  VIEWED: 'text-amber-600 dark:text-amber-300',
  PAID: 'text-emerald-600 dark:text-emerald-300',
  VOID: 'text-rose-600 dark:text-rose-300',
}

/** The invoice icon, coloured by status (same hues as the status badge). */
export function InvoiceStatusIcon({ status }: { status: string }) {
  return (
    <Receipt
      aria-hidden
      className={cn(
        'h-4 w-4 shrink-0',
        INVOICE_STATUS_ICON[status] ?? 'text-muted-foreground'
      )}
    />
  )
}
