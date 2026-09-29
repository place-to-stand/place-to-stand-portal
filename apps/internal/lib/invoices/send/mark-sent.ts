import 'server-only'

import crypto from 'node:crypto'

import { and, eq, isNull } from 'drizzle-orm'

import { invoiceSentEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, invoices } from '@/lib/db/schema'

export type SendableInvoice = {
  id: string
  status: (typeof invoices.$inferSelect)['status']
  clientId: string
  clientName: string | null
  invoiceNumber: string | null
  total: string
  issuedDate: string | null
  shareToken: string | null
  shareEnabled: boolean
}

/** The invoice fields both send paths need, with the client's name. */
export async function fetchSendableInvoice(
  id: string
): Promise<SendableInvoice | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      clientId: invoices.clientId,
      clientName: clients.name,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      issuedDate: invoices.issuedDate,
      shareToken: invoices.shareToken,
      shareEnabled: invoices.shareEnabled,
    })
    .from(invoices)
    .leftJoin(
      clients,
      and(eq(clients.id, invoices.clientId), isNull(clients.deletedAt))
    )
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .limit(1)

  return row ?? null
}

/** The issued date a send stamps, as the `date` column stores it. */
export function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0]!
}

/**
 * An existing token may already have been copied and handed out, so it is
 * never replaced — a new one is minted only when there is none.
 */
function shareTokenFor(invoice: SendableInvoice): string {
  return invoice.shareToken ?? crypto.randomUUID().replace(/-/g, '')
}

/**
 * The token the emailed link will use, saved before the email goes out.
 *
 * The link is live exactly when the invoice is sent: a draft's token is saved
 * but stays disabled, and `markInvoiceSent` turns it on only once the email
 * was accepted — so a failed send never leaves a draft with a public link. A
 * sent invoice's link is (re)enabled here, since it is about to be emailed.
 */
export async function reserveShareToken(
  invoice: SendableInvoice
): Promise<string> {
  const shareToken = shareTokenFor(invoice)
  const enable = invoice.status !== 'DRAFT' && !invoice.shareEnabled

  if (invoice.shareToken !== shareToken || enable) {
    await db
      .update(invoices)
      .set({
        shareToken,
        ...(enable ? { shareEnabled: true } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoice.id))
  }

  return shareToken
}

/**
 * DRAFT → SENT: stamps today's issued date, turns the share link on — sent
 * and shareable are one state; reverting to draft turns it back off — and
 * logs it. `recipients` is set when the portal emailed the invoice rather than
 * an admin sending it themselves. Returns the link's token.
 */
export async function markInvoiceSent(
  user: AppUser,
  invoice: SendableInvoice & { invoiceNumber: string },
  recipients?: { to: string[]; cc: string[] }
): Promise<string> {
  const shareToken = shareTokenFor(invoice)

  await db
    .update(invoices)
    .set({
      status: 'SENT',
      issuedDate: todayIsoDate(),
      shareToken,
      shareEnabled: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invoices.id, invoice.id))

  const event = invoiceSentEvent({
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

  return shareToken
}
