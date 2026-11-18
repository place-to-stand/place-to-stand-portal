import { renderBlocks, type EmailBlock } from '../blocks'
import {
  DEFAULT_EMAIL_BRAND,
  renderRichEmail,
  type EmailBrand,
  type RenderedEmail,
} from '../layout'
import { resultBlocks, type AuditEmailResult } from './audit-shared'
import { greetingName } from './contact-confirmation'

export type AuditResultsEmailArgs = {
  name: string
  result: AuditEmailResult
  replyTo: string
  /** The business sending it (Settings → Business). */
  brand?: EmailBrand
}

/** The visitor's copy of their Opportunity Audit result. */
export function auditResultsEmail({
  name,
  result,
  replyTo,
  brand = DEFAULT_EMAIL_BRAND,
}: AuditResultsEmailArgs): RenderedEmail {
  const blocks: EmailBlock[] = [
    {
      type: 'paragraph',
      text: `Hi ${greetingName(name)}, thanks for taking the Opportunity Audit. Here is what your answers pointed to.`,
    },
    ...resultBlocks(result, { includeReasons: false }),
    {
      type: 'paragraph',
      text: 'Ready to start? Just reply to this email and we will take it from there.',
    },
  ]

  const body = renderBlocks(blocks)

  return renderRichEmail(`Your ${brand.name} Opportunity Audit`, {
    brand,
    preheader: `Your audit points to the ${result.phaseName} phase.`,
    label: 'Opportunity Audit',
    bodyHtml: body.html,
    bodyText: body.text,
    footerLead: 'Questions about your result? Reply to this email or write to',
    replyTo,
  })
}
