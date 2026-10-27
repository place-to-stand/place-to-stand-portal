import type {
  InvoiceWithClient,
  InvoiceWithLineItems,
} from '@/lib/invoices/invoice-form'

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

export type CliInvoiceLineItem = {
  id: string
  description: string
  quantity: string
  unitPrice: string
  amount: string
  productCatalogItemId: string | null
  /** Paying the invoice creates an hour block for this line. */
  createsHourBlock: boolean
}

export type CliInvoiceDetail = CliInvoice & {
  billingType: string | null
  taxRate: string | null
  notes: string | null
  viewedAt: string | null
  viewedCount: number
  lineItems: CliInvoiceLineItem[]
  hourBlocks: { id: string; hoursPurchased: number }[]
}

/**
 * One invoice in full. Built field by field so the share token and the Stripe
 * checkout-session and payment-intent ids never leave the server.
 */
export function serializeInvoiceDetail(
  invoice: InvoiceWithLineItems
): CliInvoiceDetail {
  return {
    ...serializeInvoice(invoice),
    billingType: invoice.billing_type,
    taxRate: invoice.tax_rate,
    notes: invoice.notes,
    viewedAt: isoTimestamp(invoice.viewed_at),
    viewedCount: invoice.viewed_count,
    lineItems: invoice.line_items.map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      amount: item.amount,
      productCatalogItemId: item.product_catalog_item_id,
      createsHourBlock: item.creates_hour_block,
    })),
    hourBlocks: (invoice.hour_blocks ?? []).map(block => ({
      id: block.id,
      hoursPurchased: block.hours_purchased,
    })),
  }
}
