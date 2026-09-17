import { renderBlocks, type EmailBlock } from '../blocks'
import { renderRichEmail, type RenderedEmail } from '../layout'
import { resultBlocks, type AuditEmailResult } from './audit-shared'
import {
  contactRows,
  identityLine,
  sourceBlocks,
  type SubmissionContact,
  type SubmissionRepeat,
  type SubmissionSource,
} from './submission-shared'

export type AuditNotificationEmailArgs = {
  /** Deep link to the submission sheet in the admin portal. */
  submissionUrl: string
  contact: SubmissionContact
  /** The optional "anything else we should know" note. */
  message: string | null
  result: AuditEmailResult
  /** Answered questions only, in the order they were asked. */
  transcript: Array<{ prompt: string; answer: string }>
  source: SubmissionSource
  repeat: SubmissionRepeat | null
}

/**
 * Team notification for a captured Opportunity Audit. Same reading order as
 * the contact notification; the full transcript goes last because it is
 * reference material, not triage material.
 */
export function auditNotificationEmail({
  submissionUrl,
  contact,
  message,
  result,
  transcript,
  source,
  repeat,
}: AuditNotificationEmailArgs): RenderedEmail {
  const blocks: EmailBlock[] = [
    { type: 'heading', text: `New Opportunity Audit from ${contact.name}` },
    { type: 'button', label: 'Open in portal', url: submissionUrl },
    { type: 'rows', rows: contactRows(contact) },
    ...(message
      ? ([
          { type: 'label', text: 'Additional context' },
          { type: 'quote', text: message },
        ] satisfies EmailBlock[])
      : []),
    ...resultBlocks(result, { includeReasons: true }),
    { type: 'divider' },
    ...sourceBlocks(source, repeat),
    ...(transcript.length > 0
      ? ([
          { type: 'divider' },
          { type: 'label', text: 'All responses' },
          { type: 'pairs', items: transcript },
        ] satisfies EmailBlock[])
      : []),
  ]

  const body = renderBlocks(blocks)

  return renderRichEmail(
    `[Audit] ${identityLine(contact)} — ${result.phaseName} phase`,
    {
      preheader: `${contact.name} is in the ${result.phaseName} phase.`,
      label: 'New audit',
      bodyHtml: body.html,
      bodyText: body.text,
      footerLead: `Reply to this email to answer ${contact.name} directly at`,
      replyTo: contact.email,
    }
  )
}
