import 'server-only'

import { serverEnv } from '@/lib/env.server'
import { getResendClient } from '@/lib/email/resend'

type SendInvoiceEmailArgs = {
  to: string[]
  invoiceNumber: string
  formattedTotal: string
  formattedDueDate: string | null
  clientName: string
  shareUrl: string
  pdfBuffer: Buffer | null
}

export async function sendInvoiceEmail({
  to,
  invoiceNumber,
  formattedTotal,
  formattedDueDate,
  clientName,
  shareUrl,
  pdfBuffer,
}: SendInvoiceEmailArgs) {
  if (to.length === 0) return

  const resend = getResendClient()
  const greeting = `Hi ${clientName},`
  const dueLine = formattedDueDate
    ? `Due date: ${formattedDueDate}`
    : 'Due: Upon receipt'

  const subject = `Invoice ${invoiceNumber} from Place to Stand — ${formattedTotal}`

  const text = [
    greeting,
    '',
    `Please find attached invoice ${invoiceNumber} for ${formattedTotal}.`,
    '',
    dueLine,
    '',
    `View & Pay Online: ${shareUrl}`,
    '',
    'Thank you,',
    'Place to Stand',
  ].join('\n')

  const html = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #0f172a; max-width: 600px;">
      <p>${greeting}</p>
      <p>Please find attached invoice <strong>${invoiceNumber}</strong> for <strong>${formattedTotal}</strong>.</p>
      <p>${dueLine}</p>
      <p>
        <a href="${shareUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          View &amp; Pay Online
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px;">
        Or copy this link: <a href="${shareUrl}" style="color: #0369a1;">${shareUrl}</a>
      </p>
      <p>
        Thank you,<br />
        Place to Stand
      </p>
    </div>
  `

  const attachments =
    pdfBuffer != null
      ? [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer }]
      : []

  const { error } = await resend.emails.send({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    to,
    replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    subject,
    text,
    html,
    attachments,
  })

  if (error) {
    throw error
  }
}
