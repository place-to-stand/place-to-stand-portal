import { and, asc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { formSubmissions, leads } from '@/lib/db/schema'

/**
 * Email delivery state for marketing form submissions (PRD 008 §4).
 *
 * `team_notified_at` and `confirmation_sent_at` are both the record that an
 * email went out and the lock that stops it going out twice. A sender claims
 * its column before calling Resend and releases it if the call fails, so a
 * replayed payload, a double-clicked submit, and the retry sweep racing the
 * intake route all resolve to exactly one send.
 */

export type SubmissionEmailKind = 'team' | 'confirmation'

const STAMP_COLUMNS = {
  team: formSubmissions.teamNotifiedAt,
  confirmation: formSubmissions.confirmationSentAt,
} as const

// Plain `now()`: these are timestamptz columns compared against a timestamptz
// the intake route writes from JS, so the instant is what matters. (The
// `timezone('utc', now())` idiom used for `updated_at` yields a zone-less
// timestamp and only agrees with this under a UTC session.)
const now = sql`now()`

/**
 * Atomically takes the send for one email. Returns false when another caller
 * already holds it (or already sent it), or when the row is no longer eligible.
 *
 * Eligibility is re-checked here rather than trusted from the caller's earlier
 * read: delivery must have been requested, the row must be a captured lead
 * with an address, and a tombstone must never be mailed about.
 */
export async function claimSubmissionEmail(
  id: string,
  kind: SubmissionEmailKind
): Promise<boolean> {
  const column = STAMP_COLUMNS[kind]

  const rows = await db
    .update(formSubmissions)
    .set(
      kind === 'team'
        ? { teamNotifiedAt: now }
        : { confirmationSentAt: now }
    )
    .where(
      and(
        eq(formSubmissions.id, id),
        isNull(column),
        isNotNull(formSubmissions.deliveryRequestedAt),
        eq(formSubmissions.status, 'captured'),
        isNotNull(formSubmissions.contactEmail),
        isNull(formSubmissions.destroyedAt)
      )
    )
    .returning({ id: formSubmissions.id })

  return rows.length > 0
}

/** Gives a claim back after a failed send so the sweep can retry it. */
export async function releaseSubmissionEmail(
  id: string,
  kind: SubmissionEmailKind
): Promise<void> {
  await db
    .update(formSubmissions)
    .set(
      kind === 'team' ? { teamNotifiedAt: null } : { confirmationSentAt: null }
    )
    .where(eq(formSubmissions.id, id))
}

export async function getSubmissionForDelivery(id: string) {
  const [row] = await db
    .select()
    .from(formSubmissions)
    .where(
      and(eq(formSubmissions.id, id), isNull(formSubmissions.destroyedAt))
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
 * Rows the retry sweep should pick up: delivery was requested, at least one
 * email is still outstanding, and the request is old enough that the intake
 * route has finished with it but young enough to still be worth sending.
 *
 * The lower bound matters as much as the upper one. Without it the sweep could
 * see a claim the intake route is about to take and race it for no benefit.
 */
export async function listSubmissionsAwaitingEmail({
  minAgeMinutes,
  maxAgeHours,
  limit,
}: {
  minAgeMinutes: number
  maxAgeHours: number
  limit: number
}): Promise<string[]> {
  const rows = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .where(
      and(
        isNotNull(formSubmissions.deliveryRequestedAt),
        sql`${formSubmissions.deliveryRequestedAt} < ${now} - make_interval(mins => ${minAgeMinutes})`,
        sql`${formSubmissions.deliveryRequestedAt} > ${now} - make_interval(hours => ${maxAgeHours})`,
        or(
          isNull(formSubmissions.teamNotifiedAt),
          isNull(formSubmissions.confirmationSentAt)
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
