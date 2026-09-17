import {
  auditNotificationEmail,
  auditResultsEmail,
  contactConfirmationEmail,
  contactNotificationEmail,
  type AuditEmailResult,
  type RenderedEmail,
  type SubmissionContact,
  type SubmissionRepeat,
  type SubmissionSource,
} from '@pts/email'
import type { FormSubmission } from '@pts/db/types'

import { describeAttribution } from '@/lib/form-submissions/attribution'
import {
  extractAuditResponses,
  extractAuditResult,
} from '@/lib/form-submissions/types'
import { leadHref, submissionHref } from '@/lib/sheets/hrefs'

export type SubmissionEmails = {
  team: RenderedEmail
  /** Null when there is nothing to confirm, e.g. an audit with no result. */
  confirmation: RenderedEmail | null
}

export type SubmissionEmailContext = {
  /** Admin portal origin, no trailing slash. */
  portalOrigin: string
  /** Reply-To on the visitor's copy. */
  teamInbox: string
  repeat: { count: number; leadId: string | null } | null
}

const VIEWPORT_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
}

function describeDevice(row: FormSubmission): string | null {
  const parts = [
    row.viewport ? (VIEWPORT_LABELS[row.viewport] ?? row.viewport) : null,
    row.screenWidth ? `${row.screenWidth}px` : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : null
}

function buildSource(row: FormSubmission): SubmissionSource {
  return {
    summary: describeAttribution(row).label,
    landingPath: row.landingPath,
    device: describeDevice(row),
    timezone: row.timezone,
    replayUrl: row.posthogReplayUrl,
  }
}

/** Answered questions only: a skipped prompt is noise in a triage email. */
function buildTranscript(
  row: FormSubmission
): Array<{ prompt: string; answer: string }> {
  return extractAuditResponses(row.responses).flatMap(item => {
    const answer =
      item.labels.length > 0
        ? item.labels.join(', ')
        : typeof item.value === 'string'
          ? item.value.trim()
          : ''

    return answer && item.prompt ? [{ prompt: item.prompt, answer }] : []
  })
}

const UNSCORED_RESULT: AuditEmailResult = {
  phaseName: 'Unscored',
  summary: 'No scored result was stored for this audit.',
  recommendations: [],
}

/**
 * Renders both emails for a captured submission. Returns null when the row has
 * no contact to write to, which the caller treats as "nothing to send".
 */
export function renderSubmissionEmails(
  row: FormSubmission,
  { portalOrigin, teamInbox, repeat }: SubmissionEmailContext
): SubmissionEmails | null {
  if (!row.contactEmail) return null

  const contact: SubmissionContact = {
    name: row.contactName?.trim() || row.contactEmail,
    email: row.contactEmail,
    company: row.contactCompany,
    website: row.contactWebsite,
  }

  const submissionUrl = `${portalOrigin}${submissionHref(row.id)}`
  const source = buildSource(row)
  const repeatArgs: SubmissionRepeat | null = repeat
    ? {
        count: repeat.count,
        leadUrl: repeat.leadId
          ? `${portalOrigin}${leadHref(repeat.leadId)}`
          : null,
      }
    : null

  if (row.kind === 'contact') {
    const message = row.message ?? ''

    return {
      team: contactNotificationEmail({
        submissionUrl,
        contact,
        subject: row.subject,
        message,
        source,
        repeat: repeatArgs,
      }),
      confirmation: contactConfirmationEmail({
        contact,
        subject: row.subject,
        message,
        replyTo: teamInbox,
      }),
    }
  }

  const result = extractAuditResult(row.result)

  return {
    team: auditNotificationEmail({
      submissionUrl,
      contact,
      message: row.message,
      result: result ?? UNSCORED_RESULT,
      transcript: buildTranscript(row),
      source,
      repeat: repeatArgs,
    }),
    confirmation: result
      ? auditResultsEmail({ name: contact.name, result, replyTo: teamInbox })
      : null,
  }
}
