import type { FormSubmissionRecord } from './types'

/**
 * The one line that says what a submission amounted to, shown next to its
 * status badge: a contact's subject, a scored audit's phase, or how far an
 * unfinished audit got. Null when there is nothing to add to the badge.
 */
export function describeSubmissionOutcome(
  submission: Pick<
    FormSubmissionRecord,
    | 'kind'
    | 'subject'
    | 'result'
    | 'phaseId'
    | 'percentComplete'
    | 'furthestStepIndex'
    | 'stepsTotal'
  >
): string | null {
  if (submission.kind === 'contact') {
    return submission.subject?.trim() || null
  }

  const phase = submission.result?.phaseName || submission.phaseId
  if (phase) return `${phase} phase`

  if (submission.percentComplete === null) return null

  const step =
    submission.furthestStepIndex !== null && submission.stepsTotal
      ? ` · step ${Math.min(submission.furthestStepIndex + 1, submission.stepsTotal)} of ${submission.stepsTotal}`
      : ''

  return `${submission.percentComplete}%${step}`
}
