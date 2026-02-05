import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

export const proposalCreatedEvent = (args: {
  title: string
  leadName: string
  estimatedValue?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.PROPOSAL_CREATED,
  summary: `Created proposal "${args.title}" for ${args.leadName}`,
  metadata: toMetadata({
    proposal: {
      title: args.title,
      leadName: args.leadName,
      estimatedValue: args.estimatedValue ?? null,
    },
  }),
})

export const proposalSentEvent = (args: {
  title: string
  leadName: string
}): ActivityEvent => ({
  verb: ActivityVerbs.PROPOSAL_SENT,
  summary: `Sent proposal "${args.title}" to ${args.leadName}`,
  metadata: toMetadata({
    proposal: {
      title: args.title,
      leadName: args.leadName,
    },
  }),
})

export const proposalViewedEvent = (args: {
  title: string
  leadName: string
  viewCount: number
}): ActivityEvent => ({
  verb: ActivityVerbs.PROPOSAL_VIEWED,
  summary: `Proposal "${args.title}" viewed by ${args.leadName}`,
  metadata: toMetadata({
    proposal: {
      title: args.title,
      leadName: args.leadName,
      viewCount: args.viewCount,
    },
  }),
})

export const proposalAcceptedEvent = (args: {
  title: string
  signerName: string
}): ActivityEvent => ({
  verb: ActivityVerbs.PROPOSAL_ACCEPTED,
  summary: `Proposal "${args.title}" accepted and signed by ${args.signerName}`,
  metadata: toMetadata({
    proposal: {
      title: args.title,
      signerName: args.signerName,
    },
  }),
})

export const proposalRejectedEvent = (args: {
  title: string
  leadName: string
  comment?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.PROPOSAL_REJECTED,
  summary: `Proposal "${args.title}" rejected by ${args.leadName}`,
  metadata: toMetadata({
    proposal: {
      title: args.title,
      leadName: args.leadName,
      comment: args.comment ?? null,
    },
  }),
})

export const proposalCountersignedEvent = (args: {
  title: string
  countersignerName: string
}): ActivityEvent => ({
  verb: ActivityVerbs.PROPOSAL_COUNTERSIGNED,
  summary: `Proposal "${args.title}" countersigned by ${args.countersignerName}`,
  metadata: toMetadata({
    proposal: {
      title: args.title,
      countersignerName: args.countersignerName,
    },
  }),
})

export const proposalArchivedEvent = (args: {
  title: string
}): ActivityEvent => ({
  verb: ActivityVerbs.PROPOSAL_ARCHIVED,
  summary: `Archived proposal "${args.title}"`,
  metadata: toMetadata({
    proposal: { title: args.title },
  }),
})

export const proposalRestoredEvent = (args: {
  title: string
}): ActivityEvent => ({
  verb: ActivityVerbs.PROPOSAL_RESTORED,
  summary: `Restored proposal "${args.title}"`,
  metadata: toMetadata({
    proposal: { title: args.title },
  }),
})
