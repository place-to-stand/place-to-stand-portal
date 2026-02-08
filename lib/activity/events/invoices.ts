import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

export const invoiceCreatedEvent = (args: {
  clientId: string
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_CREATED,
  summary: 'Created a new invoice draft',
  metadata: toMetadata({
    invoice: { clientId: args.clientId },
  }),
})

export const invoiceSentEvent = (args: {
  invoiceNumber: string
  clientName: string
  total: string
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_SENT,
  summary: `Sent invoice ${args.invoiceNumber} to ${args.clientName} for $${args.total}`,
  metadata: toMetadata({
    invoice: {
      invoiceNumber: args.invoiceNumber,
      clientName: args.clientName,
      total: args.total,
    },
  }),
})

export const invoicePaidEvent = (args: {
  invoiceNumber: string | null
  clientName: string
  total: string
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_PAID,
  summary: `Invoice ${args.invoiceNumber ?? '(draft)'} paid by ${args.clientName} — $${args.total}`,
  metadata: toMetadata({
    invoice: {
      invoiceNumber: args.invoiceNumber,
      clientName: args.clientName,
      total: args.total,
    },
  }),
})

export const invoiceVoidedEvent = (args: {
  invoiceNumber: string | null
  clientName: string
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_VOIDED,
  summary: `Voided invoice ${args.invoiceNumber ?? '(draft)'} for ${args.clientName}`,
  metadata: toMetadata({
    invoice: {
      invoiceNumber: args.invoiceNumber,
      clientName: args.clientName,
    },
  }),
})

export const invoiceRefundedEvent = (args: {
  invoiceNumber: string | null
  clientName: string
  total: string
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_REFUNDED,
  summary: `Refunded invoice ${args.invoiceNumber ?? '(draft)'} for ${args.clientName} — $${args.total}`,
  metadata: toMetadata({
    invoice: {
      invoiceNumber: args.invoiceNumber,
      clientName: args.clientName,
      total: args.total,
    },
  }),
})
