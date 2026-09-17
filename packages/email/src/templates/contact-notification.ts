import { renderBlocks, type EmailBlock } from '../blocks'
import { renderRichEmail, type RenderedEmail } from '../layout'
import {
  contactRows,
  identityLine,
  sourceBlocks,
  type SubmissionContact,
  type SubmissionRepeat,
  type SubmissionSource,
} from './submission-shared'

export type ContactNotificationEmailArgs = {
  /** Deep link to the submission sheet in the admin portal. */
  submissionUrl: string
  contact: SubmissionContact
  subject: string | null
  message: string
  source: SubmissionSource
  repeat: SubmissionRepeat | null
}

/**
 * Team notification for a marketing-site contact form submission.
 *
 * Built to be triaged from the inbox list: the subject line carries who and
 * what, the first thing in the body is the way into the portal, and the
 * attribution we collect is summarised in one line instead of being left in
 * the database.
 */
export function contactNotificationEmail({
  submissionUrl,
  contact,
  subject,
  message,
  source,
  repeat,
}: ContactNotificationEmailArgs): RenderedEmail {
  const identity = identityLine(contact)

  const blocks: EmailBlock[] = [
    { type: 'heading', text: `New inquiry from ${contact.name}` },
    { type: 'button', label: 'Open in portal', url: submissionUrl },
    { type: 'rows', rows: contactRows(contact) },
    { type: 'label', text: subject ? `Message · ${subject}` : 'Message' },
    { type: 'quote', text: message },
    ...sourceBlocks(source, repeat),
  ]

  const body = renderBlocks(blocks)

  return renderRichEmail(
    subject ? `[Contact] ${identity} — ${subject}` : `[Contact] ${identity}`,
    {
      preheader: message.replace(/\s+/g, ' ').slice(0, 140),
      label: 'New inquiry',
      bodyHtml: body.html,
      bodyText: body.text,
      footerLead: `Reply to this email to answer ${contact.name} directly at`,
      replyTo: contact.email,
    }
  )
}
