import type { InferSelectModel } from 'drizzle-orm'

import type { invoices, invoiceLineItems } from '@/lib/db/schema'

export type Invoice = InferSelectModel<typeof invoices>
export type InvoiceLine = InferSelectModel<typeof invoiceLineItems>

export type InvoiceWithRelations = Invoice & {
  client: {
    id: string
    name: string
    slug: string | null
    billingType: string
  }
  createdByUser: {
    id: string
    fullName: string | null
    email: string
  } | null
  lineItems: InvoiceLine[]
}

export type InvoiceStatusValue = Invoice['status']
export type LineItemTypeValue = InvoiceLine['type']
