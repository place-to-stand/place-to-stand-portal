import { describeAttribution } from '@/lib/form-submissions/attribution'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'

import { isoTimestamp } from './timestamp'

/**
 * A website form submission as agents see it. Leaves out browser and PostHog
 * ids: `source` is the same one-line attribution the Submissions table shows.
 */
export type CliSubmission = {
  id: string
  kind: FormSubmissionRecord['kind']
  status: FormSubmissionRecord['status']
  name: string | null
  email: string | null
  company: string | null
  website: string | null
  subject: string | null
  message: string | null
  heardFrom: string | null
  marketingConsent: boolean | null
  source: string
  landingPath: string | null
  /** Audit only: how far the visitor got, 0-100. */
  percentComplete: number | null
  lastActivityAt: string | null
  acknowledgedAt: string | null
  archivedAt: string | null
}

export type CliSubmissionDetail = CliSubmission & {
  /** Audit only: each question and the visitor's answer. */
  responses: { prompt: string; answer: string[] }[]
  /** Audit only: the result the visitor was shown. */
  result: { phase: string; summary: string } | null
}

export function serializeSubmission(row: FormSubmissionRecord): CliSubmission {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    name: row.contactName,
    email: row.contactEmail,
    company: row.contactCompany,
    website: row.contactWebsite,
    subject: row.subject,
    message: row.message,
    heardFrom: row.heardFrom,
    marketingConsent: row.marketingConsent,
    source: describeAttribution(row).label,
    landingPath: row.landingPath,
    percentComplete: row.percentComplete,
    lastActivityAt: isoTimestamp(row.lastActivityAt),
    acknowledgedAt: isoTimestamp(row.acknowledgedAt),
    archivedAt: isoTimestamp(row.deletedAt),
  }
}

export function serializeSubmissionDetail(
  row: FormSubmissionRecord
): CliSubmissionDetail {
  return {
    ...serializeSubmission(row),
    responses: row.responses.map(item => ({
      prompt: item.prompt,
      answer: item.labels.length
        ? item.labels
        : typeof item.value === 'string'
          ? [item.value]
          : [],
    })),
    result: row.result
      ? { phase: row.result.phaseName, summary: row.result.summary }
      : null,
  }
}
