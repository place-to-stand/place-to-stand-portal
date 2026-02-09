import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

export const invoiceCreatedEvent = (args: {
  invoiceId: string
  clientName: string
  billingType: string
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_CREATED,
  summary: `Created invoice for ${args.clientName}`,
  metadata: toMetadata({
    invoice: {
      id: args.invoiceId,
      clientName: args.clientName,
      billingType: args.billingType,
    },
  }),
})

export const invoiceSentEvent = (args: {
  invoiceNumber: string
  clientName: string
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_SENT,
  summary: `Sent invoice ${args.invoiceNumber} to ${args.clientName}`,
  metadata: toMetadata({
    invoice: {
      invoiceNumber: args.invoiceNumber,
      clientName: args.clientName,
    },
  }),
})

export const invoicePaidEvent = (args: {
  invoiceNumber: string
  clientId: string
  total: string
  paymentMethod: string
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_PAID,
  summary: `Invoice ${args.invoiceNumber} paid ($${args.total})`,
  metadata: toMetadata({
    invoice: {
      invoiceNumber: args.invoiceNumber,
      clientId: args.clientId,
      total: args.total,
      paymentMethod: args.paymentMethod,
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
  invoiceNumber: string
  clientId: string
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_REFUNDED,
  summary: `Invoice ${args.invoiceNumber} refunded`,
  metadata: toMetadata({
    invoice: {
      invoiceNumber: args.invoiceNumber,
      clientId: args.clientId,
    },
  }),
})

export const monthlyInvoicesGeneratedEvent = (args: {
  count: number
  totalValue: number
}): ActivityEvent => ({
  verb: ActivityVerbs.MONTHLY_INVOICES_GENERATED,
  summary: `Generated ${args.count} monthly invoice${args.count === 1 ? '' : 's'}`,
  metadata: toMetadata({
    invoice: {
      count: args.count,
      totalValue: args.totalValue,
    },
  }),
})
