import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { toMetadata } from './shared'

export const contactCreatedEvent = (args: {
  email: string
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_CREATED,
  summary: `Created contact "${args.name || args.email}"`,
  metadata: toMetadata({
    contact: {
      email: args.email,
      name: args.name,
    },
  }),
})

export const contactUpdatedEvent = (args: {
  email: string
  name: string | null
  changedFields: string[]
  details?: Record<string, unknown>
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_UPDATED,
  summary: `Updated contact "${args.name || args.email}"${
    args.changedFields.length ? ` (${args.changedFields.join(', ')})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
  }),
})

export const contactArchivedEvent = (args: {
  email: string
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_ARCHIVED,
  summary: `Archived contact "${args.name || args.email}"`,
})

export const contactRestoredEvent = (args: {
  email: string
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_RESTORED,
  summary: `Restored contact "${args.name || args.email}"`,
})

export const contactDeletedEvent = (args: {
  email: string
  name: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.CONTACT_DELETED,
  summary: `Permanently deleted contact "${args.name || args.email}"`,
})
