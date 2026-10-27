import type { HourBlockWithClient } from '@/lib/settings/hour-blocks/hour-block-form'

import { isoTimestamp } from './timestamp'

export type CliHourBlock = {
  id: string
  clientId: string
  clientName: string | null
  hoursPurchased: number
  /** Month the hours are billed in (YYYY-MM-DD, first of the month). */
  billingMonth: string
  /** The invoice that bought the block, when one did. */
  invoiceId: string | null
  invoiceNumber: string | null
  invoiceStatus: string | null
  invoiceTotal: number | null
  invoiceIssuedDate: string | null
  notes: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export function serializeHourBlock(block: HourBlockWithClient): CliHourBlock {
  return {
    id: block.id,
    clientId: block.client_id,
    clientName: block.client?.name ?? null,
    hoursPurchased: block.hours_purchased,
    billingMonth: block.billing_month,
    invoiceId: block.invoice_id,
    invoiceNumber: block.invoice_number,
    invoiceStatus: block.invoice_status,
    invoiceTotal: block.invoice_total,
    invoiceIssuedDate: block.invoice_issued_date,
    notes: block.notes,
    archived: block.deleted_at !== null,
    createdAt: isoTimestamp(block.created_at),
    updatedAt: isoTimestamp(block.updated_at),
  }
}
