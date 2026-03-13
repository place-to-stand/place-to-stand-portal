'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { invoiceArchivedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { invoices, clients } from '@/lib/db/schema'

import { deleteSchema } from './schemas'
import type { ActionResult, DeleteInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function archiveInvoice(
  input: DeleteInput,
): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'delete',
      targetId: input.id,
    },
    async () => performArchiveInvoice(input),
  )
}

async function performArchiveInvoice(
  input: DeleteInput,
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
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoiceId))
  } catch (error) {
    console.error('Failed to archive invoice', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to archive invoice.',
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
    targetClientId: existing.clientId,
    metadata: event.metadata,
  })

  revalidatePath(INVOICES_PATH)

  return {}
}
