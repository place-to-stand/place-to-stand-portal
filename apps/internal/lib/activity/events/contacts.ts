import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

export const contactCreatedEvent = (args: {
  email: string | null
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_CREATED,
  summary: `Created person "${args.name || args.email}"`,
  metadata: toMetadata({
    contact: {
      email: args.email,
      name: args.name,
    },
  }),
})

export const contactUpdatedEvent = (args: {
  email: string | null
  name: string | null
  changedFields: string[]
  details?: Record<string, unknown>
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_UPDATED,
  summary: `Updated person "${args.name || args.email}"${
    args.changedFields.length ? ` (${args.changedFields.join(', ')})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
  }),
})

export const contactArchivedEvent = (args: {
  email: string | null
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_ARCHIVED,
  summary: `Archived person "${args.name || args.email}"`,
})

export const contactRestoredEvent = (args: {
  email: string | null
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_RESTORED,
  summary: `Restored person "${args.name || args.email}"`,
})

export const contactDeletedEvent = (args: {
  email: string | null
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_DELETED,
  summary: `Permanently deleted person "${args.name || args.email}"`,
})

export const contactInvitedToPortalEvent = (args: {
  email: string | null
  name: string | null
  /** Clients the new portal user was granted access to. */
  companyIds?: string[]
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_INVITED_TO_PORTAL,
  summary: `Invited person "${args.name || args.email}" to the client portal`,
  metadata: toMetadata({
    contact: { email: args.email, name: args.name },
    companyIds: args.companyIds,
  }),
})

type ContactClientLinkArgs = {
  contact: { name: string | null; email: string | null }
  client: { name: string }
}

export const contactClientLinkedEvent = (
  args: ContactClientLinkArgs
): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_CLIENT_LINKED,
  summary: `Linked person "${args.contact.name || args.contact.email}" to ${args.client.name}`,
  metadata: toMetadata({
    contact: { name: args.contact.name, email: args.contact.email },
    client: { name: args.client.name },
  }),
})

export const contactClientUnlinkedEvent = (
  args: ContactClientLinkArgs
): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_CLIENT_UNLINKED,
  summary: `Unlinked person "${args.contact.name || args.contact.email}" from ${args.client.name}`,
  metadata: toMetadata({
    contact: { name: args.contact.name, email: args.contact.email },
    client: { name: args.client.name },
  }),
})
