import 'server-only'

import { getResendClient } from './resend'
import { serverEnv } from '@/lib/env.server'

type SendInvoiceLinkEmailInput = {
  to: string
  invoiceNumber: string
  total: string
  dueDate: string | null
  shareUrl: string
}

export async function sendInvoiceLinkEmail({
  to,
  invoiceNumber,
  total,
  dueDate,
  shareUrl,
}: SendInvoiceLinkEmailInput): Promise<void> {
  const resend = getResendClient()

  const formattedTotal = `$${Number(total).toFixed(2)}`
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const subject = `Invoice ${invoiceNumber} — ${formattedTotal}`

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111; margin-bottom: 8px;">Invoice ${invoiceNumber}</h2>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        You have a new invoice for <strong>${formattedTotal}</strong>.
      </p>
      ${dueDateStr ? `
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          <strong>Due date:</strong> ${dueDateStr}
        </p>
      ` : ''}
      <a href="${shareUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 28px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
        View &amp; Pay Invoice
      </a>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">
        Or copy this link: ${shareUrl}
      </p>
    </div>
  `

  const text = `Invoice ${invoiceNumber} — ${formattedTotal}\n\n${dueDateStr ? `Due: ${dueDateStr}\n\n` : ''}View and pay your invoice: ${shareUrl}`

  await resend.emails.send({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    to,
    subject,
    html,
    text,
  })
}
