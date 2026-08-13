/**
 * Row shapes consumed by `invoice-pdf.ts`, copied from
 * `apps/internal/lib/invoices/invoice-form.ts` (which mirrors the internal query
 * layer's snake_case mapping).
 *
 * Only the four types the PDF path actually reaches are copied — the zod
 * schemas, `ClientRow`, and the product-catalog types stay behind. Keep these
 * field-for-field identical to the internal originals so the two PDF modules
 * stay interchangeable.
 */

export type InvoiceRow = {
  id: string
  invoice_number: string | null
  status: string
  client_id: string
  created_by: string | null
  issued_date: string | null
  due_date: string | null
  subtotal: string
  tax_rate: string | null
  tax_amount: string
  total: string
  notes: string | null
  share_token: string | null
  share_enabled: boolean
  billing_type: string | null
  viewed_at: string | null
  viewed_count: number
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type InvoiceLineItemRow = {
  id: string
  invoice_id: string
  product_catalog_item_id: string | null
  description: string
  quantity: string
  unit_price: string
  amount: string
  sort_order: number
  creates_hour_block: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type InvoiceWithClient = InvoiceRow & {
  client: {
    id: string
    name: string
    slug: string | null
    deleted_at: string | null
  } | null
}

export type InvoiceWithLineItems = InvoiceWithClient & {
  line_items: InvoiceLineItemRow[]
}
