import 'server-only'

import type { RenderedEmail } from '@pts/email'

import { sendEmail } from '@/lib/email/send'
import {
  claimSubmissionEmail,
  countCapturedSubmissionsFromEmail,
  findActiveLeadIdByEmail,
  getSubmissionForDelivery,
  markSubmissionEmailSent,
  releaseSubmissionEmail,
  type SubmissionEmailKind,
} from '@/lib/queries/form-submission-delivery'

import { addToMarketingAudience } from './audience'
import { resolveFormEmailAddresses, resolvePortalOrigin } from './addresses'
import { renderSubmissionEmails } from './render'

/**
 * `sent`    — the provider accepted it, now or in an earlier request.
 * `queued`  — not sent by this request: the send failed and the lease was
 *             released, or another request holds the lease right now. Either
 *             way the retry sweep owns it.
 * `skipped` — delivery was not requested, or the row is not eligible.
 */
export type SubmissionEmailOutcome = 'sent' | 'queued' | 'skipped'

export type SubmissionEmailOutcomes = {
  team: SubmissionEmailOutcome
  confirmation: SubmissionEmailOutcome
}

export const SKIPPED_OUTCOMES: SubmissionEmailOutcomes = {
  team: 'skipped',
  confirmation: 'skipped',
}

/**
 * "Have we heard from this address before" is a nicety in the team email, so a
 * failure here degrades to omitting the line rather than blocking the send.
 */
async function resolveRepeat(email: string) {
  try {
    const [count, leadId] = await Promise.all([
      countCapturedSubmissionsFromEmail(email),
      findActiveLeadIdByEmail(email),
    ])
    return { count, leadId }
  } catch (error) {
    console.error('Unable to resolve repeat-sender context', error)
    return null
  }
}

/**
 * Lease, send, stamp; release on failure. Never throws: a provider outage
 * must not fail the intake request, because the submission is already stored.
 *
 * The stamp is written only after the provider accepts, so a crash between
 * lease and send leaves an expiring lease rather than a false "sent". The
 * idempotency key covers the other half: if the provider accepted but the
 * response was lost, the retry is deduplicated on their side.
 */
async function sendLeased(
  id: string,
  kind: SubmissionEmailKind,
  message: RenderedEmail,
  envelope: { from: string; to: string; replyTo: string }
): Promise<{ outcome: SubmissionEmailOutcome; sentNow: boolean }> {
  let leased = false

  try {
    leased = await claimSubmissionEmail(id, kind)

    // Already sent, or someone else is sending it this minute.
    if (!leased) return { outcome: 'queued', sentNow: false }

    await sendEmail({
      ...envelope,
      ...message,
      idempotencyKey: `form-submission:${id}:${kind}`,
    })
    await markSubmissionEmailSent(id, kind)
    return { outcome: 'sent', sentNow: true }
  } catch (error) {
    console.error(`Submission ${kind} email failed`, { id, error })

    if (leased) {
      await releaseSubmissionEmail(id, kind).catch(releaseError => {
        // The lease expires on its own, so the sweep still retries this —
        // just not for another EMAIL_LEASE_MINUTES.
        console.error(`Unable to release ${kind} email lease`, {
          id,
          releaseError,
        })
      })
    }

    return { outcome: 'queued', sentNow: false }
  }
}

/**
 * Sends whatever is still outstanding for one submission. Safe to call any
 * number of times, from the intake routes and the retry sweep alike. Throws
 * only if the row cannot be read; callers decide what that means for them.
 */
export async function deliverSubmissionEmails(
  id: string
): Promise<SubmissionEmailOutcomes> {
  const row = await getSubmissionForDelivery(id)

  if (
    !row ||
    !row.deliveryRequestedAt ||
    row.status !== 'captured' ||
    !row.contactEmail
  ) {
    return SKIPPED_OUTCOMES
  }

  if (row.teamNotifiedAt && row.confirmationSentAt) {
    return { team: 'sent', confirmation: 'sent' }
  }

  const { from, teamInbox } = resolveFormEmailAddresses()

  const emails = renderSubmissionEmails(row, {
    portalOrigin: resolvePortalOrigin(),
    teamInbox,
    repeat: await resolveRepeat(row.contactEmail),
  })

  if (!emails) return SKIPPED_OUTCOMES

  const visitor = row.contactEmail
  const confirmationEmail = emails.confirmation

  const [team, confirmation] = await Promise.all([
    row.teamNotifiedAt
      ? ('sent' as const)
      : sendLeased(id, 'team', emails.team, {
          from,
          to: teamInbox,
          replyTo: visitor,
        }).then(result => result.outcome),
    row.confirmationSentAt
      ? ('sent' as const)
      : confirmationEmail
        ? sendLeased(id, 'confirmation', confirmationEmail, {
            from,
            to: visitor,
            replyTo: teamInbox,
          }).then(async ({ outcome, sentNow }) => {
            // Tied to this request having sent the confirmation, so it
            // happens once per submission, not once per replay.
            if (sentNow && row.marketingConsent) {
              await addToMarketingAudience({
                email: visitor,
                name: row.contactName,
              })
            }
            return outcome
          })
        : ('skipped' as const),
  ])

  return { team, confirmation }
}
