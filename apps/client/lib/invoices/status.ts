import { INVOICE_STATUS_TINTS, statusTint } from '@pts/ui/status-tints'

/**
 * Client-facing invoice labels. Colours come from `@pts/ui/status-tints`, shared
 * with the internal portal.
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

type ClientInvoiceStatus = keyof typeof INVOICE_STATUS_LABELS

export function getInvoiceStatusLabel(value: string): string {
  return value in INVOICE_STATUS_LABELS
    ? INVOICE_STATUS_LABELS[value as ClientInvoiceStatus]
    : value
}

export function getInvoiceStatusToken(value: string): string {
  // "Due" covers SENT and VIEWED, so both show the SENT colour.
  return statusTint(INVOICE_STATUS_TINTS, value === 'VIEWED' ? 'SENT' : value)
}
