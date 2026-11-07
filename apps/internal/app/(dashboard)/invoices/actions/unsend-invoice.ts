'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { ActivityVerbs } from '@/lib/activity/types'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import {
  paymentRefsUnchanged,
  stopOpenInvoicePayments,
  stopPaymentsRefusal,
} from '@/lib/invoices/stop-open-payments'

import { unsendSchema } from './schemas'
import type { ActionResult, UnsendInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function unsendInvoice(input: UnsendInput): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'unsend',
      targetId: input.id,
    },
    async () => performUnsendInvoice(input)
  )
}

async function performUnsendInvoice(input: UnsendInput): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = unsendSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid request.' }
  }

  const invoiceId = parsed.data.id

  const existingRows = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      invoiceNumber: invoices.invoiceNumber,
      companyId: invoices.companyId,
      stripePaymentIntentId: invoices.stripePaymentIntentId,
      stripeCheckoutSessionId: invoices.stripeCheckoutSessionId,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  const existing = existingRows[0]

  if (!existing) {
    return { error: 'Invoice not found.' }
  }

  if (existing.status !== 'SENT') {
    return { error: 'Only sent invoices can be reverted to draft.' }
  }

  // A draft can't be paid, so a payment the client has open must stop first.
  const refs = {
    paymentIntentId: existing.stripePaymentIntentId,
    checkoutSessionId: existing.stripeCheckoutSessionId,
  }
  const stopped = await stopOpenInvoicePayments(refs)
  if (stopped !== 'clear') {
    return { error: stopPaymentsRefusal(stopped, 'reverted to draft') }
  }

  try {
    const nowIso = new Date().toISOString()

    // Conditional, so a view or payment that landed meanwhile wins, and a
    // payment started meanwhile (new Stripe ids) is not left open.
    const reverted = await db
      .update(invoices)
      .set({
        status: 'DRAFT',
        issuedDate: null,
        // Sent and shareable are one state: a draft's link never resolves.
        // The token is kept, so re-sending revives links already handed out.
        shareEnabled: false,
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.status, 'SENT'),
          paymentRefsUnchanged(refs)
        )
      )
      .returning({ id: invoices.id })

    if (reverted.length === 0) {
      return {
        error:
          'This invoice changed while you were working on it. Refresh and try again.',
      }
    }

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: ActivityVerbs.INVOICE_UNSENT,
      summary: `Reverted invoice ${existing.invoiceNumber ?? invoiceId} to draft`,
      targetType: 'INVOICE',
      targetId: invoiceId,
      targetCompanyId: existing.companyId,
      metadata: { invoiceNumber: existing.invoiceNumber },
    })

    revalidatePath(INVOICES_PATH)

    return {}
  } catch (error) {
    console.error('Failed to unsend invoice', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to revert invoice to draft.',
    }
  }
}
