import { formSubmissionKind, formSubmissionStatus } from '@/lib/db/schema'
import { BADGE_TINTS } from '@pts/ui/badge-tints'

import type { AttributionChannel } from './attribution'

export const FORM_SUBMISSION_KIND_VALUES = formSubmissionKind.enumValues
export const FORM_SUBMISSION_STATUS_VALUES = formSubmissionStatus.enumValues

export type FormSubmissionKind = (typeof FORM_SUBMISSION_KIND_VALUES)[number]
export type FormSubmissionStatus =
  (typeof FORM_SUBMISSION_STATUS_VALUES)[number]

export const FORM_SUBMISSION_KIND_LABELS: Record<FormSubmissionKind, string> = {
  audit: 'Audit',
  contact: 'Contact',
}

export const FORM_SUBMISSION_STATUS_LABELS: Record<
  FormSubmissionStatus,
  string
> = {
  in_progress: 'In progress',
  abandoned: 'Abandoned',
  completed: 'Completed',
  captured: 'Captured',
}

export const FORM_SUBMISSION_STATUS_TOKENS: Record<
  FormSubmissionStatus,
  string
> = {
  in_progress: BADGE_TINTS.sky,
  abandoned: BADGE_TINTS.neutral,
  completed: BADGE_TINTS.violet,
  captured: BADGE_TINTS.emerald,
}

/** Source column badges (PRD 008 §7). Always paired with the text label. */
export const ATTRIBUTION_CHANNEL_TOKENS: Record<AttributionChannel, string> = {
  paid: BADGE_TINTS.rose,
  organic: BADGE_TINTS.emerald,
  referral: BADGE_TINTS.sky,
  social: BADGE_TINTS.violet,
  email: BADGE_TINTS.amber,
  campaign: BADGE_TINTS.indigo,
  direct: 'text-muted-foreground',
}

export const FORM_SUBMISSION_KIND_TOKENS: Record<FormSubmissionKind, string> = {
  audit: BADGE_TINTS.indigo,
  contact: BADGE_TINTS.amber,
}

/**
 * D1 (PRD 001): only rows that warrant attention count as unacknowledged —
 * contact submissions (any status) and audits that reached
 * `completed`/`captured`. In-progress and abandoned audits are noise at ad
 * volume and never flag.
 *
 * Terminology (2026-08-04 revision): the UI converges on the
 * "acknowledge" family everywhere — indicator/badge/filter say
 * "Unacknowledged", the actions are Acknowledge/Unacknowledge.
 *
 * Must stay in sync with the SQL predicates in
 * `apps/internal/lib/queries/form-submissions.ts` (`buildFilters`
 * unacknowledgedOnly + `countUnacknowledgedFormSubmissions`).
 */
const ATTENTION_AUDIT_STATUSES = [
  'completed',
  'captured',
] as const satisfies readonly FormSubmissionStatus[]

/**
 * Whether acknowledgement is meaningful for this row at all. In-progress and
 * abandoned audits never flag, so they get no acknowledge/unacknowledge
 * affordances anywhere in the UI.
 */
export function submissionWarrantsAttention(submission: {
  kind: FormSubmissionKind
  status: FormSubmissionStatus
}): boolean {
  return (
    submission.kind === 'contact' ||
    (ATTENTION_AUDIT_STATUSES as readonly string[]).includes(submission.status)
  )
}

export function isUnacknowledgedSubmission(submission: {
  kind: FormSubmissionKind
  status: FormSubmissionStatus
  acknowledgedAt: string | null
  deletedAt: string | null
}): boolean {
  if (submission.acknowledgedAt !== null || submission.deletedAt !== null) {
    return false
  }
  return submissionWarrantsAttention(submission)
}

export function isFormSubmissionKind(
  value: string | undefined
): value is FormSubmissionKind {
  return (
    value !== undefined &&
    (FORM_SUBMISSION_KIND_VALUES as readonly string[]).includes(value)
  )
}

export function isFormSubmissionStatus(
  value: string | undefined
): value is FormSubmissionStatus {
  return (
    value !== undefined &&
    (FORM_SUBMISSION_STATUS_VALUES as readonly string[]).includes(value)
  )
}
