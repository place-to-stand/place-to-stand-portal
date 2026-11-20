import { renderBlocks, type EmailBlock } from '../blocks'
import {
  DEFAULT_EMAIL_BRAND,
  renderRichEmail,
  type EmailBrand,
  type RenderedEmail,
} from '../layout'
import {
  contactRows,
  identityLine,
  type SubmissionContact,
} from './submission-shared'

export type AuditDetailsEmailArgs = {
  /** Deep link to the submission sheet in the internal portal. */
  submissionUrl: string
  contact: SubmissionContact
  /** The note they added, if any. */
  message: string | null
  /** The business sending it (Settings → Business). */
  brand?: EmailBrand
}

/**
 * Team follow-up for an audit whose visitor added their name, company or a
 * note after the capture. The capture asks for an email alone, so the
 * team notification usually goes out before any of this exists; without a
 * second email the details would only be visible to whoever reopens the row.
 *
 * Deliberately short: the result, transcript and source are already in the
 * first notification, so this carries only what is new.
 */
export function auditDetailsEmail({
  submissionUrl,
  contact,
  message,
  brand = DEFAULT_EMAIL_BRAND,
}: AuditDetailsEmailArgs): RenderedEmail {
  const blocks: EmailBlock[] = [
    { type: 'heading', text: `${contact.name} added details to their audit` },
    {
      type: 'paragraph',
      text: 'They gave their email first and filled this in afterwards, so it was not in the original notification.',
    },
    { type: 'button', label: 'Open in portal', url: submissionUrl },
    { type: 'rows', rows: contactRows(contact) },
    ...(message
      ? ([
          { type: 'label', text: 'What they want fixed first' },
          { type: 'quote', text: message },
        ] satisfies EmailBlock[])
      : []),
  ]

  const body = renderBlocks(blocks)

  return renderRichEmail(`[Audit] ${identityLine(contact)} — added details`, {
    brand,
    preheader: message
      ? `${contact.name} added a note to their audit.`
      : `${contact.name} added their details to their audit.`,
    label: 'Audit update',
    bodyHtml: body.html,
    bodyText: body.text,
    footerLead: `Reply to this email to answer ${contact.name} directly at`,
    replyTo: contact.email,
  })
}
