'use server'

import { revalidatePath } from 'next/cache'

import type { PostgresError } from 'postgres'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { invoiceDeletedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import { invoices, clients } from '@/lib/db/schema'

import { destroySchema } from './schemas'
import type { ActionResult, DestroyInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function destroyInvoice(
  input: DestroyInput,
): Promise<ActionResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'destroy',
      targetId: input.id,
    },
    async () => {
      const user = await requireUser()
      assertAdmin(user)

      const parsed = destroySchema.safeParse(input)

      if (!parsed.success) {
        return { error: 'Invalid permanent delete request.' }
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
        return {
          error: 'Archive the invoice before permanently deleting.',
        }
      }

      const clientRows = await db
        .select({ name: clients.name })
        .from(clients)
        .where(
          and(eq(clients.id, existing.clientId), isNull(clients.deletedAt)),
        )
        .limit(1)

      const clientName = clientRows[0]?.name ?? null

      try {
        await db.delete(invoices).where(eq(invoices.id, invoiceId))
      } catch (error) {
        console.error('Failed to permanently delete invoice', error)

        if (isPostgresError(error) && error.code === '23503') {
          return {
            error:
              'Cannot permanently delete this invoice while other records reference it.',
          }
        }

        return {
          error:
            error instanceof Error
              ? error.message
              : 'Unable to permanently delete invoice.',
        }
      }

      const event = invoiceDeletedEvent({
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
    },
  )
}

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  )
}
