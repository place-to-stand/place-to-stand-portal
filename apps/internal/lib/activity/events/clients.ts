import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { joinWithCommas, toMetadata } from './shared'

export const clientCreatedEvent = (args: {
  name: string
  memberIds: string[]
}): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_CREATED,
  summary: `Created client "${args.name}"`,
  metadata: toMetadata({
    client: {
      name: args.name,
    },
    // Same delta shape as CLIENT_UPDATED so the feed renders the member list.
    members: {
      added: args.memberIds,
      removed: [],
    },
  }),
})

export const clientUpdatedEvent = (args: {
  name: string
  changedFields: string[]
  memberChanges?: { added: string[]; removed: string[] }
  details?: Record<string, unknown>
}): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_UPDATED,
  summary: `Updated client "${args.name}"${
    args.changedFields.length ? ` (${joinWithCommas(args.changedFields)})` : ''
  }`,
  metadata: toMetadata({
    changedFields: args.changedFields,
    members: args.memberChanges,
    details: args.details,
  }),
})

export const clientArchivedEvent = (args: { name: string }): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_ARCHIVED,
  summary: `Archived client "${args.name}"`,
})

/** A month as "October 2026" (UTC). */
function monthName(offset: number): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)
  ).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Billing stopped. `current_month` bills last month last; `next_month` bills
 * through this month. (Stored under the CLIENT_ARCHIVED verb, as before.)
 */
export const clientBillingStoppedEvent = (args: {
  name: string
  effective: 'current_month' | 'next_month'
}): ActivityEvent => {
  const lastMonth = monthName(args.effective === 'current_month' ? -1 : 0)
  return {
    verb: ActivityVerbs.CLIENT_ARCHIVED,
    summary: `Stopped billing "${args.name}" (last month billed: ${lastMonth})`,
    metadata: { effective: args.effective, lastMonthBilled: lastMonth },
  }
}

/** Billing restarted, or a scheduled stop cancelled. */
export const clientBillingRestartedEvent = (args: {
  name: string
  effective: 'current_month' | 'next_month'
  cancelsStop: boolean
}): ActivityEvent => {
  const firstMonth = monthName(args.effective === 'current_month' ? 0 : 1)
  return {
    verb: ActivityVerbs.CLIENT_RESTORED,
    summary: args.cancelsStop
      ? `Kept billing "${args.name}" (cancelled the scheduled stop)`
      : `Restarted billing "${args.name}" (from ${firstMonth})`,
    metadata: { effective: args.effective, cancelsStop: args.cancelsStop },
  }
}

export const clientRestoredEvent = (args: { name: string }): ActivityEvent => ({
  verb: ActivityVerbs.CLIENT_RESTORED,
  summary: `Restored client "${args.name}"`,
})

