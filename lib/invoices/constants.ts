export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially Paid',
  REFUNDED: 'Refunded',
  VOID: 'Void',
}

export const LINE_ITEM_TYPE_LABELS: Record<string, string> = {
  HOURS_PREPAID: 'Hours (Prepaid)',
  HOURS_WORKED: 'Hours (Worked)',
  CUSTOM: 'Custom',
}

/**
 * Terminal invoice statuses — invoices in these states are immutable
 * (line items, totals, and client_id cannot be modified).
 */
export const TERMINAL_STATUSES = ['PAID', 'VOID', 'REFUNDED'] as const

/** Default prepaid hour quantity */
export const DEFAULT_PREPAID_HOURS = 5

/** Quick-select preset hour amounts for prepaid invoices */
export const PREPAID_HOUR_PRESETS = [5, 10, 20, 40] as const

/** Format an invoice number from prefix, year, and sequence */
export function formatInvoiceNumber(
  prefix: string,
  year: number,
  sequence: number
): string {
  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`
}
