import type { InferSelectModel } from 'drizzle-orm'
import type {
  invoices,
  invoiceLineItems,
  billingSettings,
} from '@/lib/db/schema'

export type Invoice = InferSelectModel<typeof invoices>
export type InvoiceLineItem = InferSelectModel<typeof invoiceLineItems>
export type BillingSettings = InferSelectModel<typeof billingSettings>

export type InvoiceWithLineItems = Invoice & {
  lineItems: InvoiceLineItem[]
}

export type InvoiceWithClient = Invoice & {
  client: {
    id: string
    name: string
    billingType: 'prepaid' | 'net_30'
    deletedAt: string | null
  } | null
}

export type InvoiceWithClientAndLineItems = InvoiceWithClient & {
  lineItems: InvoiceLineItem[]
}

export type InvoiceStatus = Invoice['status']
export type LineItemType = InvoiceLineItem['type']
