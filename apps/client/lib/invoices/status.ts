import { BADGE_TINTS } from '@pts/ui/badge-tints'

/**
 * Client-facing subset of the internal app's invoice status presentation
 * (`apps/internal/app/(dashboard)/invoices/_components/invoices-table-section.tsx`).
 *
 * DRAFT is intentionally absent — drafts are filtered out in the query and are
 * never surfaced in the portal. SENT and VIEWED both read as "Due": the
 * distinction between them tracks whether *we* have seen the client open the
 * invoice, which is not information the client needs about their own invoice.
 */
const INVOICE_STATUS_LABELS = {
  SENT: 'Due',
  VIEWED: 'Due',
  PAID: 'Paid',
  VOID: 'Void',
} as const

const INVOICE_STATUS_TOKENS = {
  SENT: BADGE_TINTS.sky,
  VIEWED: BADGE_TINTS.sky,
  PAID: BADGE_TINTS.emerald,
  VOID: BADGE_TINTS.neutral,
} as const

type ClientInvoiceStatus = keyof typeof INVOICE_STATUS_LABELS

export function getInvoiceStatusLabel(value: string): string {
  return value in INVOICE_STATUS_LABELS
    ? INVOICE_STATUS_LABELS[value as ClientInvoiceStatus]
    : value
}

export function getInvoiceStatusToken(value: string): string {
  return value in INVOICE_STATUS_TOKENS
    ? INVOICE_STATUS_TOKENS[value as ClientInvoiceStatus]
    : BADGE_TINTS.neutral
}
