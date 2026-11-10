import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

/** Tags put on or taken off, shown as chips in the activity feed. */
type TagMoves = { added: string[]; removed: string[] }

export const companyCreatedEvent = (args: {
  name: string
  tags?: TagMoves
}): ActivityEvent => ({
  verb: ActivityVerbs.COMPANY_CREATED,
  summary: `Created company "${args.name}"`,
  metadata: toMetadata({ company: { name: args.name }, tags: args.tags }),
})

export const companyUpdatedEvent = (args: {
  name: string
  changedFields: string[]
  details?: Record<string, unknown>
  tags?: TagMoves
}): ActivityEvent => ({
  verb: ActivityVerbs.COMPANY_UPDATED,
  summary: `Updated company "${args.name}"${
    args.changedFields.length ? ` (${args.changedFields.join(', ')})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
    tags: args.tags,
  }),
})

export const companyArchivedEvent = (args: {
  name: string
}): ActivityEvent => ({
  verb: ActivityVerbs.COMPANY_ARCHIVED,
  summary: `Archived company "${args.name}"`,
})

export const companyRestoredEvent = (args: {
  name: string
}): ActivityEvent => ({
  verb: ActivityVerbs.COMPANY_RESTORED,
  summary: `Restored company "${args.name}"`,
})

export const companyPrimaryContactSetEvent = (args: {
  companyName: string
  contactName: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.COMPANY_PRIMARY_CONTACT_SET,
  summary: args.contactName
    ? `Made ${args.contactName} the primary contact at "${args.companyName}"`
    : `Cleared the primary contact at "${args.companyName}"`,
  metadata: toMetadata({ contactName: args.contactName }),
})
