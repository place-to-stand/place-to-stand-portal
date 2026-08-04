import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

type SubmissionEventArgs = {
  kind: 'audit' | 'contact'
  contactName?: string | null
  contactEmail?: string | null
  status: string
}

/** "Jane Doe (jane@x.com)" | name | email | "anonymous audit submission" */
const describeSubmission = (args: SubmissionEventArgs): string => {
  const name = args.contactName?.trim()
  const email = args.contactEmail?.trim()

  if (name && email) {
    return `submission from ${name} (${email})`
  }

  if (name || email) {
    return `submission from ${name || email}`
  }

  return `anonymous ${args.kind} submission`
}

export const submissionAcknowledgedEvent = (
  args: SubmissionEventArgs
): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_ACKNOWLEDGED,
  summary: `Acknowledged ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})

export const submissionUnacknowledgedEvent = (
  args: SubmissionEventArgs
): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_UNACKNOWLEDGED,
  summary: `Marked ${describeSubmission(args)} as unacknowledged`,
  metadata: toMetadata({ status: args.status }),
})

export const submissionDestroyedEvent = (
  args: SubmissionEventArgs
): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_DESTROYED,
  summary: `Permanently deleted ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})

export const submissionArchivedEvent = (
  args: SubmissionEventArgs
): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_ARCHIVED,
  summary: `Archived ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})

export const submissionRestoredEvent = (
  args: SubmissionEventArgs
): ActivityEvent => ({
  verb: ActivityVerbs.SUBMISSION_RESTORED,
  summary: `Restored ${describeSubmission(args)}`,
  metadata: toMetadata({ status: args.status }),
})
