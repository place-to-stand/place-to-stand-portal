import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { formSubmissions } from '@/lib/db/schema'
import type { FormSubmission, NewFormSubmission } from '@pts/db/types'

type FormSubmissionFilters = {
  kind?: FormSubmission['kind']
  status?: FormSubmission['status']
}

function buildFilters({ kind, status }: FormSubmissionFilters) {
  return and(
    isNull(formSubmissions.deletedAt),
    kind ? eq(formSubmissions.kind, kind) : undefined,
    status ? eq(formSubmissions.status, status) : undefined
  )
}

/**
 * Idempotent write for both marketing intake routes.
 *
 * Audit beacons race — `sendBeacon` on `pagehide` has no delivery-ordering
 * guarantee, so a stale `abandoned` beacon routinely lands after `captured`.
 * All four ordering rules from the integration contract are enforced here in a
 * single statement; a read-then-write would race exactly the way the beacons
 * do.
 *
 *   1. Upsert on `session_key`.
 *   2. Stale beacons are discarded  -> the `setWhere` gate below.
 *   3. Status only advances         -> GREATEST over the status enum, whose
 *                                      DECLARATION ORDER in packages/db is the
 *                                      rank order. Postgres compares enums by
 *                                      that order, so no CASE ladder is needed.
 *   4. Non-null values are never
 *      overwritten with null        -> COALESCE(excluded.x, existing.x).
 *
 * Field-by-field policy:
 *   - GREATEST for monotonic values (status, furthest step, counters, duration)
 *     — they only ever move one way, and this is immune to a beacon that
 *     reports zeros.
 *   - COALESCE for everything nullable and irreplaceable: the scored result,
 *     the contact block, and the analytics/attribution/client envelope. Losing
 *     UTM attribution because one late beacon omitted it would be silent and
 *     unrecoverable.
 *   - Wholesale from `excluded` for values that describe the newest beacon
 *     itself (`last_trigger`, `last_activity_at`) or the current snapshot
 *     (`steps_total`, `questions_total`).
 *   - `responses` takes the newer array UNLESS that would replace a populated
 *     transcript with an empty one. The contract says every beacon carries the
 *     full question set; this guards the one violation that would destroy the
 *     most valuable data on the row.
 *
 * Note: because `answered_count` uses GREATEST while `responses` takes the
 * newer array, a visitor who clears an answer leaves the count one higher than
 * the array. That is a cosmetic edge case, and preferable to a zeroing beacon
 * wiping real progress.
 *
 * Contact submissions run through the same path. They are one-shot with a
 * unique `submissionId`, so they never conflict and every rule above is a
 * no-op for them.
 */
export async function upsertFormSubmission(row: NewFormSubmission) {
  await db
    .insert(formSubmissions)
    .values(row)
    .onConflictDoUpdate({
      target: formSubmissions.sessionKey,
      set: {
        status: sql`GREATEST(${formSubmissions.status}, excluded.status)`,
        lastTrigger: sql`excluded.last_trigger`,
        lastActivityAt: sql`excluded.last_activity_at`,
        completedAt: sql`COALESCE(${formSubmissions.completedAt}, excluded.completed_at)`,
        capturedAt: sql`COALESCE(${formSubmissions.capturedAt}, excluded.captured_at)`,
        durationMs: sql`GREATEST(${formSubmissions.durationMs}, excluded.duration_ms)`,

        furthestStepIndex: sql`GREATEST(${formSubmissions.furthestStepIndex}, excluded.furthest_step_index)`,
        stepsTotal: sql`excluded.steps_total`,
        answeredCount: sql`GREATEST(${formSubmissions.answeredCount}, excluded.answered_count)`,
        questionsTotal: sql`excluded.questions_total`,
        percentComplete: sql`GREATEST(${formSubmissions.percentComplete}, excluded.percent_complete)`,

        responses: sql`
          CASE
            WHEN jsonb_array_length(COALESCE(excluded.responses, '[]'::jsonb)) > 0
              THEN excluded.responses
            ELSE ${formSubmissions.responses}
          END
        `,
        result: sql`COALESCE(excluded.result, ${formSubmissions.result})`,
        phaseId: sql`COALESCE(excluded.phase_id, ${formSubmissions.phaseId})`,
        topServiceId: sql`COALESCE(excluded.top_service_id, ${formSubmissions.topServiceId})`,

        contactName: sql`COALESCE(excluded.contact_name, ${formSubmissions.contactName})`,
        contactEmail: sql`COALESCE(excluded.contact_email, ${formSubmissions.contactEmail})`,
        contactCompany: sql`COALESCE(excluded.contact_company, ${formSubmissions.contactCompany})`,
        contactWebsite: sql`COALESCE(excluded.contact_website, ${formSubmissions.contactWebsite})`,
        message: sql`COALESCE(excluded.message, ${formSubmissions.message})`,
        marketingConsent: sql`COALESCE(excluded.marketing_consent, ${formSubmissions.marketingConsent})`,

        posthogDistinctId: sql`COALESCE(excluded.posthog_distinct_id, ${formSubmissions.posthogDistinctId})`,
        posthogSessionId: sql`COALESCE(excluded.posthog_session_id, ${formSubmissions.posthogSessionId})`,
        posthogReplayUrl: sql`COALESCE(excluded.posthog_replay_url, ${formSubmissions.posthogReplayUrl})`,

        utmSource: sql`COALESCE(excluded.utm_source, ${formSubmissions.utmSource})`,
        utmMedium: sql`COALESCE(excluded.utm_medium, ${formSubmissions.utmMedium})`,
        utmCampaign: sql`COALESCE(excluded.utm_campaign, ${formSubmissions.utmCampaign})`,
        utmTerm: sql`COALESCE(excluded.utm_term, ${formSubmissions.utmTerm})`,
        utmContent: sql`COALESCE(excluded.utm_content, ${formSubmissions.utmContent})`,
        gclid: sql`COALESCE(excluded.gclid, ${formSubmissions.gclid})`,
        referrer: sql`COALESCE(excluded.referrer, ${formSubmissions.referrer})`,
        landingPath: sql`COALESCE(excluded.landing_path, ${formSubmissions.landingPath})`,

        viewport: sql`COALESCE(excluded.viewport, ${formSubmissions.viewport})`,
        screenWidth: sql`COALESCE(excluded.screen_width, ${formSubmissions.screenWidth})`,
        timezone: sql`COALESCE(excluded.timezone, ${formSubmissions.timezone})`,
        language: sql`COALESCE(excluded.language, ${formSubmissions.language})`,
        userAgent: sql`COALESCE(excluded.user_agent, ${formSubmissions.userAgent})`,

        updatedAt: sql`timezone('utc'::text, now())`,
      },
      // Rule 2: a beacon older than what we already stored is a no-op. The
      // route still returns 200 — discarding it is the expected outcome.
      setWhere: sql`excluded.last_activity_at >= ${formSubmissions.lastActivityAt}`,
    })
}

export async function listFormSubmissions({
  offset,
  limit,
  kind,
  status,
}: FormSubmissionFilters & { offset: number; limit: number }) {
  return db
    .select()
    .from(formSubmissions)
    .where(buildFilters({ kind, status }))
    .orderBy(desc(formSubmissions.lastActivityAt))
    .limit(limit)
    .offset(offset)
}

export async function countFormSubmissions(filters: FormSubmissionFilters) {
  const [row] = await db
    .select({ value: count() })
    .from(formSubmissions)
    .where(buildFilters(filters))

  return row?.value ?? 0
}

export async function getFormSubmissionById(id: string) {
  const [row] = await db
    .select()
    .from(formSubmissions)
    .where(and(eq(formSubmissions.id, id), isNull(formSubmissions.deletedAt)))
    .limit(1)

  return row ?? null
}
