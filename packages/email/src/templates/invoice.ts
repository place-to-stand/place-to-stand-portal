import { renderBlocks, type EmailBlock } from '../blocks'
import { renderRichEmail, type RenderedEmail } from '../layout'

export type InvoiceEmailArgs = {
  subject: string
  clientName: string
  invoiceNumber: string
  /** Already formatted, e.g. "$4,250.00". */
  amountDue: string
  /** Already formatted, e.g. "Sep 28, 2026". */
  issuedDate: string
  /**
   * The note the admin wrote in the send dialog: plain text, blank lines
   * between paragraphs. Escaped here, never trusted as HTML.
   */
  message: string
  /** The public share page, where the client views and pays. */
  viewUrl: string
  replyTo: string
}

export const INVOICE_EMAIL_BUTTON_LABEL = 'View and pay invoice'

/**
 * An invoice sent to a client from the admin portal: the admin's own note,
 * the three facts a payer needs, and one button to the share page, which is
 * where the line items and the card form live.
 */
export function invoiceEmail({
  subject,
  clientName,
  invoiceNumber,
  amountDue,
  issuedDate,
  message,
  viewUrl,
  replyTo,
}: InvoiceEmailArgs): RenderedEmail {
  const paragraphs = message
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)

  const blocks: EmailBlock[] = [
    ...paragraphs.map(text => ({ type: 'paragraph' as const, text })),
    {
      type: 'rows',
      rows: [
        { label: 'Invoice', value: invoiceNumber },
        { label: 'Amount due', value: amountDue },
        { label: 'Issued', value: issuedDate },
      ],
    },
  ]

  const body = renderBlocks(blocks)

  return renderRichEmail(subject, {
    preheader: `Invoice ${invoiceNumber} for ${amountDue}, due on receipt.`,
    label: `Invoice · ${clientName}`,
    bodyHtml: body.html,
    bodyText: body.text,
    action: { label: INVOICE_EMAIL_BUTTON_LABEL, url: viewUrl },
    footerLead: 'Questions about this invoice? Reply to this email or write to',
    replyTo,
  })
}
