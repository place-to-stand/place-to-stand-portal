'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import {
  buildInvoiceEmailDraft,
  emailInvoice as emailInvoiceWithResend,
  type InvoiceEmailDraft,
} from '@/lib/invoices/send/email'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'

import { INVOICES_PATH } from './helpers'

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')

const contentSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().trim().min(1, 'Subject is required').max(500),
  message: z.string().max(5000),
})

const emailInvoiceSchema = contentSchema.extend({
  to: z.array(emailSchema).min(1, 'Add at least one recipient').max(20),
  cc: z.array(emailSchema).max(20),
  requestId: z.string().uuid(),
})

export type EmailInvoiceInput = z.infer<typeof emailInvoiceSchema>

type Result<T> =
  { ok: true; data: T; error?: undefined } | { ok: false; error: string }

function failure(
  error: unknown,
  fallback: string
): { ok: false; error: string } {
  if (error instanceof HttpError) return { ok: false, error: error.message }
  console.error(fallback, error)
  return { ok: false, error: fallback }
}

/** Prefilled recipients, subject and note for the send dialog. */
export async function getInvoiceEmailDraft(
  id: string
): Promise<Result<InvoiceEmailDraft>> {
  try {
    const user = await requireUser()
    return { ok: true, data: await buildInvoiceEmailDraft(user, id) }
  } catch (error) {
    return failure(error, 'Unable to load invoice email.')
  }
}

type EmailInvoiceResult = Result<{ invoiceNumber: string; markedSent: boolean }>

/** "Send to client" / "Email again": sends through Resend; a draft is marked sent. */
export async function emailInvoice(
  input: EmailInvoiceInput
): Promise<EmailInvoiceResult> {
  return trackSettingsServerInteraction<EmailInvoiceResult>(
    { entity: 'invoice', mode: 'send', targetId: input.id },
    async () => {
      const parsed = emailInvoiceSchema.safeParse(input)
      if (!parsed.success) {
        return {
          ok: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid email.',
        }
      }
      try {
        const user = await requireUser()
        const { id, requestId, ...content } = parsed.data
        const data = await emailInvoiceWithResend(user, id, content, requestId)
        revalidatePath(INVOICES_PATH)
        return { ok: true, data }
      } catch (error) {
        return failure(error, 'Unable to send invoice email.')
      }
    }
  )
}
