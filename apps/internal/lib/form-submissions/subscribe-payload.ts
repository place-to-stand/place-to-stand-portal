import { z } from 'zod'

import type { NewFormSubmission } from '@pts/db/types'

import {
  analyticsSchema,
  attributionSchema,
  clientSchema,
  isoDateTime,
} from './envelope'

/**
 * Validation for `POST /api/integrations/subscribe-submissions`.
 *
 * The blog/mailing-list signup is one-shot like the contact form, but carries
 * an email and nothing else. Submitting it is the marketing consent (the form
 * says so), so every row records `marketing_consent = true`. It shares the
 * analytics/attribution/client blocks with the other two payloads so all three
 * forms land in the same table with the same attribution data.
 *
 * See docs/integrations/marketing-form-submissions.md for the full contract.
 */
export const subscribePayloadSchema = z.object({
  submissionId: z.uuid(),
  // The page the visitor signed up from, e.g. a blog post URL.
  sourceDetail: z.string().trim().max(2048).min(1),
  submittedAt: isoDateTime,

  subscriber: z.object({
    email: z.email().max(320),
  }),

  analytics: analyticsSchema,
  attribution: attributionSchema,
  client: clientSchema,
})

export type SubscribePayload = z.infer<typeof subscribePayloadSchema>

export function toSubscribeSubmissionRow(
  payload: SubscribePayload,
  requestUserAgent: string | null
): NewFormSubmission {
  const { subscriber, analytics, attribution, client } = payload

  return {
    kind: 'subscribe',
    sessionKey: payload.submissionId,
    // A signup always arrives complete — there is no partial state.
    status: 'captured',
    lastTrigger: null,
    sourceDetail: payload.sourceDetail,

    startedAt: payload.submittedAt,
    lastActivityAt: payload.submittedAt,
    completedAt: payload.submittedAt,
    capturedAt: payload.submittedAt,
    durationMs: null,

    // Audit-only progress and payload columns stay null for subscribe rows.
    furthestStepIndex: null,
    stepsTotal: null,
    answeredCount: null,
    questionsTotal: null,
    percentComplete: null,
    responses: null,
    result: null,
    phaseId: null,
    topServiceId: null,

    // The form asks for an email only.
    contactName: null,
    contactEmail: subscriber.email,
    contactCompany: null,
    contactWebsite: null,
    subject: null,
    message: null,
    // Submitting the form is the consent.
    marketingConsent: true,
    heardFrom: null,

    posthogDistinctId: analytics.posthogDistinctId,
    posthogSessionId: analytics.posthogSessionId,
    posthogReplayUrl: analytics.posthogReplayUrl,

    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
    utmTerm: attribution.utmTerm,
    utmContent: attribution.utmContent,
    gclid: attribution.gclid,
    referrer: attribution.referrer,
    landingPath: attribution.landingPath,

    viewport: client.viewport,
    screenWidth: client.screenWidth,
    timezone: client.timezone,
    language: client.language,
    // The payload value wins, as for contact: the marketing site posts from
    // its server, so our request header is its fetch agent, not the browser.
    userAgent: client.userAgent ?? requestUserAgent,

    // No team notification or confirmation email for signups (for now).
    deliveryRequestedAt: null,
  }
}
