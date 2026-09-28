import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

export const invoiceCreatedEvent = (args: {
  clientName?: string | null
  invoiceNumber?: string | null
  proposalTitle?: string | null
  proposalId?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_CREATED,
  summary: args.proposalTitle
    ? `Created invoice for ${args.clientName ?? 'client'} from proposal "${args.proposalTitle}"`
    : `Created invoice for ${args.clientName ?? 'client'}`,
  metadata: toMetadata({
    clientName: args.clientName ?? null,
    invoiceNumber: args.invoiceNumber ?? null,
    source: args.proposalId ? 'proposal' : null,
    proposalId: args.proposalId ?? null,
    proposalTitle: args.proposalTitle ?? null,
  }),
})

export const invoiceUpdatedEvent = (args: {
  invoiceNumber?: string | null
  changedFields: string[]
  details?: Record<string, unknown>
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_UPDATED,
  summary: args.invoiceNumber
    ? `Updated invoice ${args.invoiceNumber}`
    : 'Updated invoice draft',
  metadata: toMetadata({
    invoiceNumber: args.invoiceNumber ?? null,
    changedFields: args.changedFields,
    details: args.details,
  }),
})

export const invoiceSentEvent = (args: {
  invoiceNumber: string
  clientName?: string | null
  total?: string | null
  /** Set when the portal emailed it; absent when it was only marked sent. */
  recipients?: { to: string[]; cc: string[] }
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_SENT,
  summary: args.recipients
    ? `Emailed invoice ${args.invoiceNumber} to ${args.recipients.to.join(', ')}`
    : `Sent invoice ${args.invoiceNumber} to ${args.clientName ?? 'client'}`,
  metadata: toMetadata({
    invoiceNumber: args.invoiceNumber,
    clientName: args.clientName ?? null,
    total: args.total ?? null,
    recipients: args.recipients ?? null,
  }),
})

/** A sent invoice emailed again — a reminder; the status does not change. */
export const invoiceEmailedEvent = (args: {
  invoiceNumber: string
  clientName?: string | null
  total?: string | null
  recipients: { to: string[]; cc: string[] }
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_EMAILED,
  summary: `Emailed invoice ${args.invoiceNumber} again to ${args.recipients.to.join(', ')}`,
  metadata: toMetadata({
    invoiceNumber: args.invoiceNumber,
    clientName: args.clientName ?? null,
    total: args.total ?? null,
    recipients: args.recipients,
  }),
})

export const invoiceViewedEvent = (args: {
  invoiceNumber?: string | null
  viewCount?: number
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_VIEWED,
  summary: args.invoiceNumber
    ? `Invoice ${args.invoiceNumber} was viewed`
    : 'Invoice was viewed',
  metadata: toMetadata({
    invoiceNumber: args.invoiceNumber ?? null,
    viewCount: args.viewCount ?? 1,
  }),
})

export const invoicePaidEvent = (args: {
  invoiceNumber?: string | null
  total?: string | null
  clientName?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_PAID,
  summary: args.invoiceNumber
    ? `Invoice ${args.invoiceNumber} was paid`
    : 'Invoice was paid',
  metadata: toMetadata({
    invoiceNumber: args.invoiceNumber ?? null,
    total: args.total ?? null,
    clientName: args.clientName ?? null,
  }),
})

export const invoiceVoidedEvent = (args: {
  invoiceNumber?: string | null
  clientName?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_VOIDED,
  summary: args.invoiceNumber
    ? `Voided invoice ${args.invoiceNumber}`
    : 'Voided invoice draft',
  metadata: toMetadata({
    invoiceNumber: args.invoiceNumber ?? null,
    clientName: args.clientName ?? null,
  }),
})

export const invoiceArchivedEvent = (args: {
  invoiceNumber?: string | null
  clientName?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_ARCHIVED,
  summary: args.invoiceNumber
    ? `Archived invoice ${args.invoiceNumber}`
    : 'Archived invoice draft',
  metadata: toMetadata({
    invoiceNumber: args.invoiceNumber ?? null,
    clientName: args.clientName ?? null,
  }),
})

export const invoiceRestoredEvent = (args: {
  invoiceNumber?: string | null
  clientName?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_RESTORED,
  summary: args.invoiceNumber
    ? `Restored invoice ${args.invoiceNumber}`
    : 'Restored invoice draft',
  metadata: toMetadata({
    invoiceNumber: args.invoiceNumber ?? null,
    clientName: args.clientName ?? null,
  }),
})

export const invoiceDeletedEvent = (args: {
  invoiceNumber?: string | null
  clientName?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.INVOICE_DELETED,
  summary: args.invoiceNumber
    ? `Permanently deleted invoice ${args.invoiceNumber}`
    : 'Permanently deleted invoice draft',
  metadata: toMetadata({
    invoiceNumber: args.invoiceNumber ?? null,
    clientName: args.clientName ?? null,
  }),
})
