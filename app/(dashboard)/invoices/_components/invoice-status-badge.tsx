'use client'

import { Badge } from '@/components/ui/badge'
import { INVOICE_STATUS_LABELS, isOverdue } from '@/lib/invoices/constants'
import type { InvoiceStatusValue } from '@/lib/invoices/types'

const STATUS_VARIANTS: Record<
  InvoiceStatusValue | 'OVERDUE',
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'secondary',
  SENT: 'outline',
  VIEWED: 'outline',
  PAID: 'default',
  PARTIALLY_PAID: 'outline',
  REFUNDED: 'secondary',
  VOID: 'destructive',
  OVERDUE: 'destructive',
}

type InvoiceStatusBadgeProps = {
  status: InvoiceStatusValue
  dueDate: string | null
}

export function InvoiceStatusBadge({ status, dueDate }: InvoiceStatusBadgeProps) {
  const overdue = isOverdue(status, dueDate)
  const displayStatus = overdue ? 'OVERDUE' : status
  const label = overdue ? 'Overdue' : INVOICE_STATUS_LABELS[status]

  return (
    <Badge variant={STATUS_VARIANTS[displayStatus]}>
      {label}
    </Badge>
  )
}
