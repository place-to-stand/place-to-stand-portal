import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'

import { joinWithCommas, toMetadata } from './shared'

export const businessSettingsUpdatedEvent = (args: {
  changedFields: string[]
  details?: {
    before: Record<string, unknown>
    after: Record<string, unknown>
  }
}): ActivityEvent => ({
  verb: ActivityVerbs.BUSINESS_SETTINGS_UPDATED,
  summary: args.changedFields.length
    ? `Updated business settings (${joinWithCommas(args.changedFields)})`
    : 'Confirmed business settings',
  metadata: toMetadata({
    changedFields: args.changedFields,
    details: args.details,
  }),
})
