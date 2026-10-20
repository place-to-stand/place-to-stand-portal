import type { InvoiceWithClient } from '@/lib/invoices/invoice-form'

import { isoTimestamp } from './timestamp'

export type CliInvoice = {
  id: string
  invoiceNumber: string | null
  status: string
  clientId: string
  clientName: string | null
  issuedDate: string | null
  dueDate: string | null
  /** Money arrives from Postgres `numeric` as a string; kept as one so no
   *  precision is lost on the way to the caller. */
  subtotal: string
  taxAmount: string
  total: string
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export function serializeInvoice(invoice: InvoiceWithClient): CliInvoice {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    clientId: invoice.client_id,
    clientName: invoice.client?.name ?? null,
    issuedDate: invoice.issued_date,
    dueDate: invoice.due_date,
    subtotal: invoice.subtotal,
    taxAmount: invoice.tax_amount,
    total: invoice.total,
    paidAt: isoTimestamp(invoice.paid_at),
    createdAt: isoTimestamp(invoice.created_at),
    updatedAt: isoTimestamp(invoice.updated_at),
  }
}
