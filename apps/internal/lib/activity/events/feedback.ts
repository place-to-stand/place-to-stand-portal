import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

/**
 * Feedback reports sit on their project's activity. Summaries name the
 * report's type, never what the reporter wrote or who they are, so the
 * trail doesn't repeat a visitor's details.
 */
type FeedbackEventArgs = {
  reportId: string
  /** 'Bug', 'Request' or 'Question'. */
  typeLabel: string
  projectName: string
}

const describe = ({ typeLabel, projectName }: FeedbackEventArgs) =>
  `${typeLabel.toLowerCase()} report on "${projectName}"`

const event = (
  verb: ActivityEvent['verb'],
  summary: string,
  args: FeedbackEventArgs
): ActivityEvent => ({
  verb,
  summary,
  metadata: toMetadata({ reportId: args.reportId }),
})

export const feedbackAcknowledgedEvent = (args: FeedbackEventArgs) =>
  event(
    ActivityVerbs.FEEDBACK_ACKNOWLEDGED,
    `Marked a ${describe(args)} as seen`,
    args
  )

export const feedbackUnacknowledgedEvent = (args: FeedbackEventArgs) =>
  event(
    ActivityVerbs.FEEDBACK_UNACKNOWLEDGED,
    `Marked a ${describe(args)} as new`,
    args
  )

export const feedbackMarkedSpamEvent = (args: FeedbackEventArgs) =>
  event(
    ActivityVerbs.FEEDBACK_MARKED_SPAM,
    `Marked a ${describe(args)} as spam`,
    args
  )

export const feedbackMarkedNotSpamEvent = (args: FeedbackEventArgs) =>
  event(
    ActivityVerbs.FEEDBACK_MARKED_NOT_SPAM,
    `Marked a ${describe(args)} as not spam`,
    args
  )

export const feedbackArchivedEvent = (args: FeedbackEventArgs) =>
  event(ActivityVerbs.FEEDBACK_ARCHIVED, `Archived a ${describe(args)}`, args)

export const feedbackRestoredEvent = (args: FeedbackEventArgs) =>
  event(ActivityVerbs.FEEDBACK_RESTORED, `Restored a ${describe(args)}`, args)

export const feedbackTurnedIntoTaskEvent = (
  args: FeedbackEventArgs & { taskId: string; taskTitle: string }
): ActivityEvent => ({
  verb: ActivityVerbs.FEEDBACK_TURNED_INTO_TASK,
  summary: `Turned a ${describe(args)} into task "${args.taskTitle}"`,
  metadata: toMetadata({ reportId: args.reportId, taskId: args.taskId }),
})

export const feedbackSettingsUpdatedEvent = (args: {
  projectName: string
  enabled: boolean
  origins: string[]
}): ActivityEvent => ({
  verb: ActivityVerbs.PROJECT_FEEDBACK_SETTINGS_UPDATED,
  summary: args.enabled
    ? `Set "${args.projectName}" to take feedback from ${
        args.origins.length === 1
          ? '1 website'
          : `${args.origins.length} websites`
      } plus its Vercel domains`
    : `Turned off feedback for "${args.projectName}"`,
  metadata: toMetadata({ enabled: args.enabled, origins: args.origins }),
})
