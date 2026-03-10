'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { invoiceVoidedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { invoices, clients } from '@/lib/db/schema'

import { voidSchema } from './schemas'
import type { ActionResult, VoidInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function voidInvoice(
  input: VoidInput,
): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'void',
      targetId: input.id,
    },
    async () => performVoidInvoice(input),
  )
}

async function performVoidInvoice(
  input: VoidInput,
): Promise<ActionResult> {
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
      clientId: invoices.clientId,
      invoiceNumber: invoices.invoiceNumber,
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
    .select({ name: clients.name })
    .from(clients)
    .where(and(eq(clients.id, existing.clientId), isNull(clients.deletedAt)))
    .limit(1)

  const clientName = clientRows[0]?.name ?? null

  try {
    await db
      .update(invoices)
      .set({
        status: 'VOID',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoiceId))
  } catch (error) {
    console.error('Failed to void invoice', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to void invoice.',
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
    targetClientId: existing.clientId,
    metadata: event.metadata,
  })

  revalidatePath(INVOICES_PATH)

  return {}
}
