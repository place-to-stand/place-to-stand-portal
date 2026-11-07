'use server'
import { isClientCompany } from '@pts/db/client-state'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { invoiceVoidedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { companies, invoices } from '@/lib/db/schema'
import {
  paymentRefsUnchanged,
  stopOpenInvoicePayments,
  stopPaymentsRefusal,
} from '@/lib/invoices/stop-open-payments'

import { voidSchema } from './schemas'
import type { ActionResult, VoidInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function voidInvoice(input: VoidInput): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'void',
      targetId: input.id,
    },
    async () => performVoidInvoice(input)
  )
}

async function performVoidInvoice(input: VoidInput): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = voidSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid void request.' }
  }

  const invoiceId = parsed.data.id

  const existingRows = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      companyId: invoices.companyId,
      invoiceNumber: invoices.invoiceNumber,
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

  if (existing.status === 'PAID' || existing.status === 'VOID') {
    return { error: 'This invoice cannot be voided.' }
  }

  const clientRows = await db
    .select({ name: companies.name })
    .from(companies)
    .where(and(isClientCompany(), eq(companies.id, existing.companyId)))
    .limit(1)

  const clientName = clientRows[0]?.name ?? null

  // A client with the invoice open could otherwise still pay it.
  const refs = {
    paymentIntentId: existing.stripePaymentIntentId,
    checkoutSessionId: existing.stripeCheckoutSessionId,
  }
  const stopped = await stopOpenInvoicePayments(refs)
  if (stopped !== 'clear') {
    return { error: stopPaymentsRefusal(stopped, 'voided') }
  }

  try {
    // Conditional, so a payment that landed meanwhile keeps the invoice Paid,
    // and a payment started meanwhile (new Stripe ids) is not left open.
    const voided = await db
      .update(invoices)
      .set({
        status: 'VOID',
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(invoices.id, invoiceId),
          inArray(invoices.status, ['DRAFT', 'SENT', 'VIEWED']),
          paymentRefsUnchanged(refs)
        )
      )
      .returning({ id: invoices.id })

    if (voided.length === 0) {
      return {
        error:
          'This invoice changed while you were working on it. Refresh and try again.',
      }
    }
  } catch (error) {
    console.error('Failed to void invoice', error)

    return {
      error: error instanceof Error ? error.message : 'Unable to void invoice.',
    }
  }

  const event = invoiceVoidedEvent({
    invoiceNumber: existing.invoiceNumber,
    clientName,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'INVOICE',
    targetId: invoiceId,
    targetCompanyId: existing.companyId,
    metadata: event.metadata,
  })

  revalidatePath(INVOICES_PATH)

  return {}
}
