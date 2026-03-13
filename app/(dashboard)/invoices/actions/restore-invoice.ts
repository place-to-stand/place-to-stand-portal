'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { invoiceRestoredEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { invoices, clients } from '@/lib/db/schema'

import { restoreSchema } from './schemas'
import type { ActionResult, RestoreInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function restoreInvoice(
  input: RestoreInput,
): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'restore',
      targetId: input.id,
    },
    async () => performRestoreInvoice(input),
  )
}

async function performRestoreInvoice(
  input: RestoreInput,
): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = restoreSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid restore request.' }
  }

  const invoiceId = parsed.data.id

  const existingRows = await db
    .select({
      id: invoices.id,
      clientId: invoices.clientId,
      invoiceNumber: invoices.invoiceNumber,
      deletedAt: invoices.deletedAt,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  const existing = existingRows[0]

  if (!existing) {
    return { error: 'Invoice not found.' }
  }

  if (!existing.deletedAt) {
    return { error: 'Invoice is already active.' }
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
      .set({ deletedAt: null, updatedAt: new Date().toISOString() })
      .where(eq(invoices.id, invoiceId))
  } catch (error) {
    console.error('Failed to restore invoice', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to restore invoice.',
    }
  }

  const event = invoiceRestoredEvent({
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
    targetClientId: existing.clientId,
    metadata: event.metadata,
  })

  revalidatePath(INVOICES_PATH)

  return {}
}
