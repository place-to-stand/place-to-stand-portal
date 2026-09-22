import { and, asc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { formSubmissions, leads } from '@/lib/db/schema'
import {
  EMAIL_LEASE_MINUTES,
  RETRY_MAX_AGE_HOURS,
  RETRY_MIN_AGE_MINUTES,
  STUCK_ALERT_AFTER_MINUTES,
  SWEEP_INTERVAL_MINUTES,
} from '@/lib/form-submissions/delivery/constants'

/**
 * Email delivery state for marketing form submissions (PRD 008 §4).
 *
 * Each email has a lease (`*_email_claimed_at`) and a stamp
 * (`team_notified_at` / `confirmation_sent_at`). A sender takes the lease,
 * calls the provider, and writes the stamp only once the provider accepted the
 * message; a failure clears the lease. The lease expires, so a process that
 * dies mid-send does not strand the email, and the stamp is written only on
 * acceptance, so a crash can never make an unsent email look sent. Duplicate
 * delivery when the provider accepted but the response was lost is handled by
 * the provider-side idempotency key the sender attaches.
 */

export type SubmissionEmailKind = 'team' | 'confirmation'

const COLUMNS = {
  team: {
    claimed: formSubmissions.teamEmailClaimedAt,
    sent: formSubmissions.teamNotifiedAt,
  },
  confirmation: {
    claimed: formSubmissions.confirmationEmailClaimedAt,
    sent: formSubmissions.confirmationSentAt,
  },
} as const

// Plain `now()`: these are timestamptz columns compared against a timestamptz
// the intake route writes from JS, so the instant is what matters. (The
// `timezone('utc', now())` idiom used for `updated_at` yields a zone-less
// timestamp and only agrees with this under a UTC session.)
const now = sql`now()`

/**
 * Atomically leases one email for sending. Returns false when it is already
 * sent, when another sender holds a live lease, or when the row is no longer
 * eligible.
 *
 * Eligibility is re-checked here rather than trusted from the caller's earlier
 * read: delivery must have been requested, the row must be a captured lead
 * with an address, and a tombstone must never be mailed about.
 */
export async function claimSubmissionEmail(
  id: string,
  kind: SubmissionEmailKind
): Promise<boolean> {
  const { claimed, sent } = COLUMNS[kind]

  const rows = await db
    .update(formSubmissions)
    .set(
      kind === 'team'
        ? { teamEmailClaimedAt: now }
        : { confirmationEmailClaimedAt: now }
    )
    .where(
      and(
        eq(formSubmissions.id, id),
        isNull(sent),
        or(
          isNull(claimed),
          sql`${claimed} < ${now} - make_interval(mins => ${EMAIL_LEASE_MINUTES})`
        ),
        isNotNull(formSubmissions.deliveryRequestedAt),
        eq(formSubmissions.status, 'captured'),
        isNotNull(formSubmissions.contactEmail),
        isNull(formSubmissions.destroyedAt)
      )
    )
    .returning({ id: formSubmissions.id })

  return rows.length > 0
}

/** Records that the provider accepted the message. The lease is kept as history. */
export async function markSubmissionEmailSent(
  id: string,
  kind: SubmissionEmailKind
): Promise<void> {
  await db
    .update(formSubmissions)
    .set(
      kind === 'team' ? { teamNotifiedAt: now } : { confirmationSentAt: now }
    )
    .where(eq(formSubmissions.id, id))
}

/** Gives a lease back after a failed send so the sweep can retry at once. */
export async function releaseSubmissionEmail(
  id: string,
  kind: SubmissionEmailKind
): Promise<void> {
  await db
    .update(formSubmissions)
    .set(
      kind === 'team'
        ? { teamEmailClaimedAt: null }
        : { confirmationEmailClaimedAt: null }
    )
    .where(eq(formSubmissions.id, id))
}

export async function getSubmissionForDelivery(id: string) {
  const [row] = await db
    .select()
    .from(formSubmissions)
    .where(and(eq(formSubmissions.id, id), isNull(formSubmissions.destroyedAt)))
    .limit(1)

  return row ?? null
}

/**
 * The row a payload would land on, before it is upserted. Lets a replay reuse
 * its earlier delivery decision instead of spending throttle quota, and lets a
 * replay the stale-beacon gate discards still flush outstanding sends.
 */
export async function findDeliveryStateBySessionKey(
  sessionKey: string
): Promise<{ id: string; deliveryRequestedAt: string | null } | null> {
  const [row] = await db
    .select({
      id: formSubmissions.id,
      deliveryRequestedAt: formSubmissions.deliveryRequestedAt,
    })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.sessionKey, sessionKey),
        isNull(formSubmissions.destroyedAt)
      )
    )
    .limit(1)

  return row ?? null
}

/**
 * How many captured submissions this address has made, this one included.
 * Archived rows count: "have we heard from them before" does not depend on
 * whether someone tidied the list.
 */
export async function countCapturedSubmissionsFromEmail(
  email: string
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(formSubmissions)
    .where(
      and(
        sql`lower(${formSubmissions.contactEmail}) = lower(${email})`,
        eq(formSubmissions.status, 'captured'),
        isNull(formSubmissions.destroyedAt)
      )
    )

  return row?.value ?? 0
}

/** The active lead already carrying this address, if one exists. */
export async function findActiveLeadIdByEmail(
  email: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        sql`lower(${leads.contactEmail}) = lower(${email})`,
        isNull(leads.deletedAt)
      )
    )
    .limit(1)

  return row?.id ?? null
}

/**
 * A confirmation only exists for a contact submission or a scored audit. An
 * audit captured without a stored result has nothing to confirm, and must not
 * sit in the retry batch forever looking like a failed send.
 */
const confirmationApplies = or(
  eq(formSubmissions.kind, 'contact'),
  isNotNull(formSubmissions.result)
)

/**
 * Rows the retry sweep should pick up: delivery was requested, an applicable
 * email is still unsent, and the request is old enough that the intake route
 * has finished with it but young enough to still be worth sending.
 *
 * Lease state is deliberately not filtered here; `claimSubmissionEmail` is the
 * one place that decides, so a live lease simply makes the claim fail.
 */
export async function listSubmissionsAwaitingEmail({
  limit,
}: {
  limit: number
}): Promise<string[]> {
  const rows = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .where(
      and(
        isNotNull(formSubmissions.deliveryRequestedAt),
        sql`${formSubmissions.deliveryRequestedAt} < ${now} - make_interval(mins => ${RETRY_MIN_AGE_MINUTES})`,
        sql`${formSubmissions.deliveryRequestedAt} > ${now} - make_interval(hours => ${RETRY_MAX_AGE_HOURS})`,
        or(
          isNull(formSubmissions.teamNotifiedAt),
          and(isNull(formSubmissions.confirmationSentAt), confirmationApplies)
        ),
        eq(formSubmissions.status, 'captured'),
        isNotNull(formSubmissions.contactEmail),
        isNull(formSubmissions.destroyedAt)
      )
    )
    .orderBy(asc(formSubmissions.deliveryRequestedAt))
    .limit(limit)

  return rows.map(row => row.id)
}

/**
 * Rows whose email has just become "stuck": requested between the alert
 * threshold and one sweep interval beyond it, with an applicable email still
 * unsent. Selecting only that window is what makes each row alert once —
 * the next run sees it as older than the window and leaves it alone. (A
 * skipped cron run therefore skips that run's alerts; the retry itself is
 * unaffected.)
 */
export async function listSubmissionsStuckAtThreshold(): Promise<
  Array<{
    id: string
    kind: 'audit' | 'contact'
    contactName: string | null
    contactEmail: string | null
  }>
> {
  return db
    .select({
      id: formSubmissions.id,
      kind: formSubmissions.kind,
      contactName: formSubmissions.contactName,
      contactEmail: formSubmissions.contactEmail,
    })
    .from(formSubmissions)
    .where(
      and(
        isNotNull(formSubmissions.deliveryRequestedAt),
        sql`${formSubmissions.deliveryRequestedAt} <= ${now} - make_interval(mins => ${STUCK_ALERT_AFTER_MINUTES})`,
        sql`${formSubmissions.deliveryRequestedAt} > ${now} - make_interval(mins => ${STUCK_ALERT_AFTER_MINUTES + SWEEP_INTERVAL_MINUTES})`,
        or(
          isNull(formSubmissions.teamNotifiedAt),
          and(isNull(formSubmissions.confirmationSentAt), confirmationApplies)
        ),
        eq(formSubmissions.status, 'captured'),
        isNotNull(formSubmissions.contactEmail),
        isNull(formSubmissions.destroyedAt)
      )
    )
    .orderBy(asc(formSubmissions.deliveryRequestedAt))
}
