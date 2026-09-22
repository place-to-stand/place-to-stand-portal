import { renderBlocks, type EmailBlock } from '../blocks'
import { renderRichEmail, type RenderedEmail } from '../layout'
import { contactRows, type SubmissionContact } from './submission-shared'

export type ContactConfirmationEmailArgs = {
  contact: SubmissionContact
  subject: string | null
  message: string
  replyTo: string
}

/** First word of the name, for the greeting; "there" when it is blank. */
export function greetingName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there'
}

/**
 * Receipt sent to a visitor who used the marketing-site contact form. Echoes
 * what they sent so a typo in their own address or message is visible to them.
 */
export function contactConfirmationEmail({
  contact,
  subject,
  message,
  replyTo,
}: ContactConfirmationEmailArgs): RenderedEmail {
  const blocks: EmailBlock[] = [
    { type: 'heading', text: 'Thanks for reaching out' },
    {
      type: 'paragraph',
      text: `Hi ${greetingName(contact.name)}, we've got your message and will get back to you within one business day. Here's a copy of what you sent.`,
    },
    {
      type: 'rows',
      rows: [
        ...contactRows(contact),
        ...(subject ? [{ label: 'Subject', value: subject }] : []),
      ],
    },
    { type: 'label', text: 'Your message' },
    { type: 'quote', text: message },
  ]

  const body = renderBlocks(blocks)

  return renderRichEmail('Thanks for contacting Place To Stand', {
    preheader: "We've got your message and will reply within one business day.",
    label: 'Message received',
    bodyHtml: body.html,
    bodyText: body.text,
    footerLead: 'Need to add anything? Reply to this email or write to',
    replyTo,
  })
}
