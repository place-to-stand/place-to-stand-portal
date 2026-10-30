import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'
import { formatHours } from '@pts/ui/numbers'

import { joinWithCommas, toMetadata } from './shared'

export const timeLogCreatedEvent = (args: {
  hours: number
  projectName?: string | null
  loggedOn?: string
  linkedTaskCount: number
  taskIds?: string[]
  notePresent?: boolean
  userId?: string
}): ActivityEvent => {
  const formattedHours = formatHours(args.hours)
  const summary = args.projectName
    ? `Logged ${formattedHours} to ${args.projectName}`
    : `Logged ${formattedHours}`

  return {
    verb: ActivityVerbs.TIME_LOG_CREATED,
    summary,
    metadata: toMetadata({
      hours: args.hours,
      loggedOn: args.loggedOn,
      linkedTaskCount: args.linkedTaskCount,
      taskIds: args.taskIds,
      notePresent: args.notePresent,
      userId: args.userId,
    }),
  }
}

export const timeLogUpdatedEvent = (args: {
  hours: number
  projectName?: string | null
  changedFields: string[]
  details: { before: Record<string, unknown>; after: Record<string, unknown> }
}): ActivityEvent => {
  const formattedHours = formatHours(args.hours)
  const fieldSummary = args.changedFields.length
    ? ` (${joinWithCommas(args.changedFields)})`
    : ''
  const summary = args.projectName
    ? `Updated a ${formattedHours} time log on ${args.projectName}${fieldSummary}`
    : `Updated a ${formattedHours} time log${fieldSummary}`

  return {
    verb: ActivityVerbs.TIME_LOG_UPDATED,
    summary,
    metadata: toMetadata({
      changedFields: args.changedFields,
      details: args.details,
    }),
  }
}

export const timeLogDeletedEvent = (args: {
  hours: number
  loggedOn: string
  projectName?: string | null
}): ActivityEvent => {
  const formattedHours = formatHours(args.hours)
  const summary = args.projectName
    ? `Archived a ${formattedHours} time log from ${args.projectName}`
    : `Archived a ${formattedHours} time log`

  return {
    verb: ActivityVerbs.TIME_LOG_DELETED,
    summary,
    metadata: toMetadata({
      hours: args.hours,
      loggedOn: args.loggedOn,
    }),
  }
}

export const timeLogRestoredEvent = (args: {
  hours: number
  loggedOn: string
  projectName?: string | null
}): ActivityEvent => {
  const formattedHours = formatHours(args.hours)
  const summary = args.projectName
    ? `Restored a ${formattedHours} time log to ${args.projectName}`
    : `Restored a ${formattedHours} time log`

  return {
    verb: ActivityVerbs.TIME_LOG_RESTORED,
    summary,
    metadata: toMetadata({
      hours: args.hours,
      loggedOn: args.loggedOn,
    }),
  }
}
