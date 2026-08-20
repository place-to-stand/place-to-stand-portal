'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import {
  hourBlockCreatedEvent,
  hourBlockUpdatedEvent,
} from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { closedMonthWarning } from '@/lib/data/reports/close'
import { db } from '@/lib/db'
import { clients, hourBlocks, invoices } from '@/lib/db/schema'
import {
  currentMonthStartUtc,
  resolveHourBlockBillingMonth,
} from '@/lib/queries/clients/billing-terms'
import {
  getActiveClientSummary,
  getHourBlockWithClientById,
} from '@/lib/queries/hour-blocks'

import { hourBlockSchema } from './schemas'
import type { ActionResult, HourBlockInput } from './types'
import { HOUR_BLOCKS_PATH } from './helpers'

export async function saveHourBlock(
  input: HourBlockInput,
): Promise<ActionResult> {
  const mode = input.id ? 'edit' : 'create'
  const targetId = input.id ?? null

  return trackSettingsServerInteraction(
    {
      entity: 'hour_block',
      mode,
      targetId,
      metadata: {
        clientId: input.clientId,
      },
    },
    async () => performSaveHourBlock(input),
  )
}

type LinkedInvoice = {
  id: string
  invoiceNumber: string | null
}

/**
 * Verify the picked invoice exists and is active. A cross-client link is
 * allowed with a non-blocking warning — when hours are transferred between
 * clients, keeping the original invoice preserves the purchase record.
 */
async function resolveLinkedInvoice(
  invoiceId: string,
  clientId: string,
): Promise<{ invoice?: LinkedInvoice; warning?: string; error?: string }> {
  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
      clientName: clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)

  const invoice = rows[0]

  if (!invoice) {
    return { error: 'Selected invoice could not be found.' }
  }

  const warning =
    invoice.clientId !== clientId
      ? `${invoice.invoiceNumber ?? 'The linked invoice'} was issued to ${invoice.clientName ?? 'another client'} — the link is kept as the original purchase record.`
      : undefined

  return {
    invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber },
    warning,
  }
}

async function performSaveHourBlock(
  input: HourBlockInput,
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = hourBlockSchema.safeParse(input)

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten()
    const message = formErrors[0] ?? 'Please correct the highlighted fields.'

    return { error: message, fieldErrors }
  }

  const { id, clientId, hoursPurchased } = parsed.data
  const invoiceId = parsed.data.invoiceId ?? null
  const notes =
    parsed.data.notes && parsed.data.notes.length > 0 ? parsed.data.notes : null
  const hoursPurchasedValue = hoursPurchased.toString()

  const client = await getActiveClientSummary(user, clientId)

  if (!client) {
    return { error: 'Selected client could not be found.' }
  }

  let linkedInvoice: LinkedInvoice | null = null
  let invoiceWarning: string | undefined

  if (invoiceId) {
    const resolved = await resolveLinkedInvoice(invoiceId, clientId)

    if (resolved.error) {
      return {
        error: resolved.error,
        fieldErrors: { invoiceId: [resolved.error] },
      }
    }

    linkedInvoice = resolved.invoice ?? null
    invoiceWarning = resolved.warning
  }

  const invoiceNumber = linkedInvoice?.invoiceNumber ?? null

  const targetClientName = client.name
  const nowIso = new Date().toISOString()
  let warning: string | undefined

  if (!id) {
    try {
      // Attribute the block to the first month it can be billed in — clamped
      // forward past a pending prepaid cutover (PRD 002 D13).
      const billingMonth = await resolveHourBlockBillingMonth(clientId)

      const [inserted] = await db
        .insert(hourBlocks)
        .values({
          clientId,
          hoursPurchased: hoursPurchasedValue,
          invoiceId: linkedInvoice?.id ?? null,
          notes,
          createdBy: user.id,
          billingMonth,
        })
        .returning({ id: hourBlocks.id })

      if (!inserted) {
        throw new Error('Unable to create hour block.')
      }

      const event = hourBlockCreatedEvent({
        clientName: targetClientName,
        hoursPurchased,
        invoiceNumber,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'HOUR_BLOCK',
        targetId: inserted.id,
        targetClientId: clientId,
        metadata: event.metadata,
      })

      // PRD 002 section 05: closed-month warning (current month closed
      // early), or informational note when the block bills ahead of a
      // pending prepaid cutover. Non-blocking either way.
      warning = await closedMonthWarning(user, [billingMonth])
      if (!warning && billingMonth > currentMonthStartUtc()) {
        const label = new Date(`${billingMonth}T00:00:00Z`).toLocaleDateString(
          'en-US',
          { month: 'long', year: 'numeric', timeZone: 'UTC' }
        )
        warning = `${targetClientName} switches to prepaid later — this block will be billed in ${label}.`
      }
    } catch (error) {
      console.error('Failed to create hour block', error)

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create hour block.',
      }
    }
  } else {
    const existingHourBlock = await getHourBlockWithClientById(user, id)

    if (!existingHourBlock) {
      return { error: 'Hour block not found.' }
    }

    const invoiceChanged =
      (existingHourBlock.invoice_id ?? null) !== (linkedInvoice?.id ?? null)

    try {
      await db
        .update(hourBlocks)
        .set({
          clientId,
          hoursPurchased: hoursPurchasedValue,
          invoiceId: linkedInvoice?.id ?? null,
          notes,
          // The line-item link belongs to the invoice the block was created
          // from; re-pointing the block at another invoice orphans it.
          ...(invoiceChanged ? { invoiceLineItemId: null } : {}),
          updatedAt: nowIso,
        })
        .where(eq(hourBlocks.id, id))
    } catch (error) {
      console.error('Failed to update hour block', error)

      return {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update hour block.',
      }
    }

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existingHourBlock.client_id !== clientId) {
      changedFields.push('client')
      previousDetails.clientId = existingHourBlock.client_id
      previousDetails.clientName = existingHourBlock.client?.name ?? null
      nextDetails.clientId = clientId
      nextDetails.clientName = targetClientName
    }

    if (existingHourBlock.hours_purchased !== hoursPurchased) {
      changedFields.push('hours')
      previousDetails.hoursPurchased = existingHourBlock.hours_purchased
      nextDetails.hoursPurchased = hoursPurchased
    }

    if (invoiceChanged) {
      changedFields.push('invoice')
      previousDetails.invoiceId = existingHourBlock.invoice_id
      previousDetails.invoiceNumber = existingHourBlock.invoice_number
      nextDetails.invoiceId = linkedInvoice?.id ?? null
      nextDetails.invoiceNumber = invoiceNumber
    }

    if ((existingHourBlock.notes ?? null) !== notes) {
      changedFields.push('notes')
      previousDetails.notes = existingHourBlock.notes
      nextDetails.notes = notes
    }

    if (changedFields.length > 0) {
      const event = hourBlockUpdatedEvent({
        clientName: targetClientName,
        changedFields,
        details: {
          before: previousDetails,
          after: nextDetails,
        },
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'HOUR_BLOCK',
        targetId: id,
        targetClientId: clientId,
        metadata: event.metadata,
      })
    }

    // PRD 002 section 05: editing a block whose billing month is closed
    // shows as drift until the month is re-closed.
    warning = await closedMonthWarning(user, [existingHourBlock.billing_month])
  }

  revalidatePath(HOUR_BLOCKS_PATH)

  const combinedWarning =
    [invoiceWarning, warning].filter(Boolean).join(' ') || undefined

  return combinedWarning ? { warning: combinedWarning } : {}
}
