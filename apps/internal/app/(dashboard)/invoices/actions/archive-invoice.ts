'use server'
import { isClientCompany } from '@pts/db/client-state'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { invoiceArchivedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { companies, invoices } from '@/lib/db/schema'
import {
  paymentRefsUnchanged,
  stopOpenInvoicePayments,
  stopPaymentsRefusal,
} from '@/lib/invoices/stop-open-payments'

import { deleteSchema } from './schemas'
import type { ActionResult, DeleteInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function archiveInvoice(
  input: DeleteInput
): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'delete',
      targetId: input.id,
    },
    async () => performArchiveInvoice(input)
  )
}

async function performArchiveInvoice(
  input: DeleteInput
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = deleteSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid delete request.' }
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

  // A paid invoice is a sale on the books: archiving it would drop it from
  // the monthly close and sales tax reports.
  if (existing.status === 'PAID') {
    return { error: 'Paid invoices cannot be archived.' }
  }

  const clientRows = await db
    .select({ name: companies.name })
    .from(companies)
    .where(and(isClientCompany(), eq(companies.id, existing.companyId)))
    .limit(1)

  const clientName = clientRows[0]?.name ?? null

  // An archived invoice drops out of the books, so a payment the client
  // still has open must stop first.
  const refs = {
    paymentIntentId: existing.stripePaymentIntentId,
    checkoutSessionId: existing.stripeCheckoutSessionId,
  }
  const stopped = await stopOpenInvoicePayments(refs)
  if (stopped !== 'clear') {
    return { error: stopPaymentsRefusal(stopped, 'archived') }
  }

  try {
    // Conditional, so a payment that landed or started meanwhile wins.
    const archived = await db
      .update(invoices)
      .set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(invoices.id, invoiceId),
          ne(invoices.status, 'PAID'),
          paymentRefsUnchanged(refs)
        )
      )
      .returning({ id: invoices.id })

    if (archived.length === 0) {
      return {
        error:
          'This invoice changed while you were working on it. Refresh and try again.',
      }
    }
  } catch (error) {
    console.error('Failed to archive invoice', error)

    return {
      error:
        error instanceof Error ? error.message : 'Unable to archive invoice.',
    }
  }

  const event = invoiceArchivedEvent({
    invoiceNumber: existing.invoiceNumber,
    clientName,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'INVOICE',
    targetId: existing.id,
    targetCompanyId: existing.companyId,
    metadata: event.metadata,
  })

  revalidatePath(INVOICES_PATH)

  return {}
}
