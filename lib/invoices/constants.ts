import type { InvoiceStatusValue } from './types'

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusValue, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially Paid',
  REFUNDED: 'Refunded',
  VOID: 'Void',
}

/** Statuses where the invoice cannot be edited or deleted */
export const TERMINAL_STATUSES: InvoiceStatusValue[] = [
  'PAID',
  'PARTIALLY_PAID',
  'REFUNDED',
  'VOID',
]

/** Statuses where the invoice cannot have its line items modified */
export const IMMUTABLE_STATUSES: InvoiceStatusValue[] = [
  'SENT',
  'VIEWED',
  'PAID',
  'PARTIALLY_PAID',
  'REFUNDED',
  'VOID',
]

export function isOverdue(
  status: InvoiceStatusValue,
  dueDate: string | null
): boolean {
  if (!dueDate) return false
  if (TERMINAL_STATUSES.includes(status)) return false
  return new Date(dueDate) < new Date()
}

export function isImmutable(status: InvoiceStatusValue): boolean {
  return IMMUTABLE_STATUSES.includes(status)
}

export function isTerminal(status: InvoiceStatusValue): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/** Preset hour values for prepaid invoices */
export const HOUR_PRESETS = [5, 10, 20, 40] as const
export const DEFAULT_HOURS = 5
