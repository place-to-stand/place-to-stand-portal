import 'server-only'

import { and, count, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { formSubmissions, notifications } from '@/lib/db/schema'
import {
  RETRY_MAX_AGE_HOURS,
  STUCK_ALERT_AFTER_MINUTES,
} from '@/lib/form-submissions/delivery/constants'
import { confirmationApplies } from '@/lib/queries/form-submission-delivery'

export type EmailQueueHealth = {
  /** Requested under an hour ago and not sent yet: normal while a send is in flight. */
  waiting: number
  /** Over an hour late and still being retried. */
  stuck: number
  /** Past the retry window in the last 30 days: never sent. */
  gaveUp: number
  /** Sent in the last 7 days, for scale. */
  sentLastWeek: number
}

const unsent = or(
  isNull(formSubmissions.teamNotifiedAt),
  and(isNull(formSubmissions.confirmationSentAt), confirmationApplies)
)

const deliverable = and(
  isNotNull(formSubmissions.deliveryRequestedAt),
  eq(formSubmissions.status, 'captured'),
  isNotNull(formSubmissions.contactEmail),
  isNull(formSubmissions.destroyedAt)
)

const age = sql`now() - ${formSubmissions.deliveryRequestedAt}`

/** The website form email queue, the one queue that must drain on its own. */
export async function readEmailQueueHealth(): Promise<EmailQueueHealth> {
  const [row] = await db
    .select({
      waiting: sql<number>`count(*) filter (where ${unsent} and ${age} < make_interval(mins => ${STUCK_ALERT_AFTER_MINUTES}))::int`,
      stuck: sql<number>`count(*) filter (where ${unsent} and ${age} >= make_interval(mins => ${STUCK_ALERT_AFTER_MINUTES}) and ${age} < make_interval(hours => ${RETRY_MAX_AGE_HOURS}))::int`,
      gaveUp: sql<number>`count(*) filter (where ${unsent} and ${age} >= make_interval(hours => ${RETRY_MAX_AGE_HOURS}) and ${age} < interval '30 days')::int`,
      sentLastWeek: sql<number>`count(*) filter (where ${formSubmissions.teamNotifiedAt} > now() - interval '7 days')::int`,
    })
    .from(formSubmissions)
    .where(deliverable)

  return {
    waiting: row?.waiting ?? 0,
    stuck: row?.stuck ?? 0,
    gaveUp: row?.gaveUp ?? 0,
    sentLastWeek: row?.sentLastWeek ?? 0,
  }
}

/** Unread, unarchived notifications older than a week, across everyone. */
export async function countStaleUnreadNotifications(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        isNull(notifications.readAt),
        isNull(notifications.clearedAt),
        lt(notifications.createdAt, sql`now() - interval '7 days'`)
      )
    )
  return Number(row?.value ?? 0)
}
