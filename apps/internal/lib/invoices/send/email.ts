import 'server-only'

import {
  invoiceEmail,
  type InvoiceEmailArgs,
  type RenderedEmail,
} from '@pts/email'
import { formatCalendarDate } from '@pts/ui/dates'

import { invoiceEmailedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { sendEmail } from '@/lib/email/send'
import { serverEnv } from '@/lib/env.server'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import { resolvePortalOrigin } from '@/lib/form-submissions/delivery/addresses'
import {
  fetchContactsForClient,
  type ClientContactRow,
} from '@/lib/queries/clients/contacts'
import { fetchActiveStaff, type StaffMember } from '@/lib/updates/staff'

import {
  reserveShareToken,
  fetchSendableInvoice,
  markInvoiceSent,
  todayIsoDate,
  type SendableInvoice,
} from './mark-sent'

/** Statuses an invoice can be emailed from; a draft is also marked sent. */
const EMAILABLE_STATUSES = new Set(['DRAFT', 'SENT', 'VIEWED'])

export type InvoiceEmailContact = {
  id: string
  name: string
  email: string
  isPrimary: boolean
}

/**
 * Everything in the email except what the admin writes. The dialog renders
 * its live preview from these with the same `invoiceEmail` template the send
 * uses, so the preview cannot drift from what goes out.
 */
export type InvoiceEmailFacts = Omit<InvoiceEmailArgs, 'subject' | 'message'>

/** What the send dialog opens with: every field prefilled, all editable. */
export type InvoiceEmailDraft = {
  invoiceNumber: string
  clientName: string
  /** Formatted, for the dialog's description. */
  amountDue: string
  facts: InvoiceEmailFacts
  /** Labelled "(you)" in the Cc picker. */
  senderEmail: string
  /** SENT or VIEWED: this is a reminder and the status will not change. */
  isResend: boolean
  contacts: InvoiceEmailContact[]
  staff: StaffMember[]
  to: string[]
  cc: string[]
  subject: string
  message: string
}

export type InvoiceEmailInput = {
  to: string[]
  cc: string[]
  subject: string
  message: string
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

async function loadEmailableInvoice(
  invoiceId: string
): Promise<SendableInvoice & { invoiceNumber: string }> {
  const invoice = await fetchSendableInvoice(invoiceId)
  if (!invoice) throw new NotFoundError('Invoice not found.')
  if (!EMAILABLE_STATUSES.has(invoice.status)) {
    throw new BadRequestError(
      'Only draft, sent, or viewed invoices can be emailed.'
    )
  }
  if (!invoice.invoiceNumber) {
    throw new BadRequestError('Invoice is missing an invoice number.')
  }
  return { ...invoice, invoiceNumber: invoice.invoiceNumber }
}

/**
 * The primary contact is addressed by default. With no primary set, a client
 * with exactly one contact gets that contact; otherwise nobody is pre-checked
 * and the admin picks.
 */
function defaultRecipients(contacts: ClientContactRow[]): ClientContactRow[] {
  const primary = contacts.filter(contact => contact.isPrimary)
  if (primary.length > 0) return primary
  return contacts.length === 1 ? contacts : []
}

function firstName(name: string | null | undefined): string | null {
  return name?.trim().split(/\s+/)[0] || null
}

export async function buildInvoiceEmailDraft(
  user: AppUser,
  invoiceId: string
): Promise<InvoiceEmailDraft> {
  assertAdmin(user)

  const invoice = await loadEmailableInvoice(invoiceId)
  const [contacts, staff] = await Promise.all([
    fetchContactsForClient(invoice.clientId),
    fetchActiveStaff(),
  ])

  const addressed = defaultRecipients(contacts)
  const greeting = firstName(addressed[0]?.name) ?? 'there'
  const signOff = firstName(user.full_name) ?? 'Place To Stand'
  const amount = usd.format(Number(invoice.total))
  const isResend = invoice.status !== 'DRAFT'

  const opening = isResend
    ? `A quick reminder that invoice ${invoice.invoiceNumber} for ${amount} is still open. You can view it and pay online with the button below.`
    : `Here's invoice ${invoice.invoiceNumber} for ${amount}. You can view the details and pay online with the button below.`

  return {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName ?? 'Client',
    amountDue: amount,
    // A draft has no live link yet; the preview's button only needs an href.
    facts: emailFacts(user, invoice, invoice.shareToken ?? 'preview'),
    senderEmail: user.email.toLowerCase(),
    isResend,
    contacts: contacts.map(contact => ({
      id: contact.id,
      name: contact.name,
      email: contact.email.toLowerCase(),
      isPrimary: contact.isPrimary,
    })),
    staff,
    to: addressed.map(contact => contact.email.toLowerCase()),
    // Resend leaves no copy in anyone's Sent folder, so the sender is copied.
    cc: [user.email.toLowerCase()],
    subject: isResend
      ? `Reminder: invoice ${invoice.invoiceNumber} from Place To Stand`
      : `Invoice ${invoice.invoiceNumber} from Place To Stand`,
    message: `Hi ${greeting},\n\n${opening}\n\nThanks,\n${signOff}`,
  }
}

function emailFacts(
  user: AppUser,
  invoice: SendableInvoice & { invoiceNumber: string },
  shareToken: string
): InvoiceEmailFacts {
  return {
    clientName: invoice.clientName ?? 'Client',
    invoiceNumber: invoice.invoiceNumber,
    amountDue: usd.format(Number(invoice.total)),
    // A draft is issued the moment it sends, so the email says today.
    issuedDate: formatCalendarDate(invoice.issuedDate ?? todayIsoDate()) ?? '',
    viewUrl: `${resolvePortalOrigin()}/share/invoices/${shareToken}`,
    replyTo: user.email,
  }
}

function renderFor(
  user: AppUser,
  invoice: SendableInvoice & { invoiceNumber: string },
  input: Pick<InvoiceEmailInput, 'subject' | 'message'>,
  shareToken: string
): RenderedEmail {
  return invoiceEmail({ ...emailFacts(user, invoice, shareToken), ...input })
}

/**
 * Emails the invoice through Resend, then — for a draft — marks it sent,
 * which is what makes the emailed link live. Nothing a client can reach
 * changes until Resend has accepted the message: a failed send leaves a draft
 * a private draft. `requestId` (one per dialog open) keys Resend's
 * idempotency, so a retry after a lost response cannot send twice.
 */
export async function emailInvoice(
  user: AppUser,
  invoiceId: string,
  input: InvoiceEmailInput,
  requestId: string
): Promise<{ invoiceNumber: string; markedSent: boolean }> {
  assertAdmin(user)

  if (input.to.length === 0) {
    throw new BadRequestError('Add at least one recipient before sending.')
  }
  if (!input.subject.trim()) {
    throw new BadRequestError('Add a subject before sending.')
  }

  const invoice = await loadEmailableInvoice(invoiceId)
  const shareToken = await reserveShareToken(invoice)
  const rendered = renderFor(user, invoice, input, shareToken)
  const recipients = { to: input.to, cc: input.cc }

  await sendEmail({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    to: input.to,
    cc: input.cc.filter(email => !input.to.includes(email)),
    replyTo: user.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    idempotencyKey: `invoice-email:${invoice.id}:${requestId}`,
  })

  if (invoice.status === 'DRAFT') {
    await markInvoiceSent(user, { ...invoice, shareToken }, recipients)
    return { invoiceNumber: invoice.invoiceNumber, markedSent: true }
  }

  const event = invoiceEmailedEvent({
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    total: invoice.total,
    recipients,
  })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'INVOICE',
    targetId: invoice.id,
    targetClientId: invoice.clientId,
    metadata: event.metadata,
  })

  return { invoiceNumber: invoice.invoiceNumber, markedSent: false }
}
