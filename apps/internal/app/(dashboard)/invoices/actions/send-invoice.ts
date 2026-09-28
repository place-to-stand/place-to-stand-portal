'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import {
  fetchSendableInvoice,
  markInvoiceSent,
} from '@/lib/invoices/send/mark-sent'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'

import { sendSchema } from './schemas'
import type { SendResult, SendInput } from './types'
import { INVOICES_PATH } from './helpers'

/**
 * "Mark as sent": for an invoice the admin delivers themselves. No email goes
 * out (`emailInvoice` is the path that sends one); the link goes live and its
 * token comes back so the button can copy it.
 */
export async function sendInvoiceAction(
  input: SendInput,
): Promise<SendResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'send',
      targetId: input.id,
    },
    async () => performSendInvoice(input),
  )
}

async function performSendInvoice(
  input: SendInput,
): Promise<SendResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = sendSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid send request.' }
  }

  const existing = await fetchSendableInvoice(parsed.data.id)

  if (!existing) {
    return { error: 'Invoice not found.' }
  }

  if (existing.status !== 'DRAFT') {
    return { error: 'Only draft invoices can be sent.' }
  }

  const invoiceNumber = existing.invoiceNumber

  if (!invoiceNumber) {
    return { error: 'Invoice is missing an invoice number.' }
  }

  try {
    const shareToken = await markInvoiceSent(user, {
      ...existing,
      invoiceNumber,
    })

    revalidatePath(INVOICES_PATH)

    return { invoiceNumber, shareToken }
  } catch (error) {
    console.error('Failed to send invoice', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to send invoice.',
    }
  }
}
