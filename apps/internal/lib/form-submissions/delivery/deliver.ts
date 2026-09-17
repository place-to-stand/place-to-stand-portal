import 'server-only'

import type { RenderedEmail } from '@pts/email'

import { sendEmail } from '@/lib/email/send'
import {
  claimSubmissionEmail,
  countCapturedSubmissionsFromEmail,
  findActiveLeadIdByEmail,
  getSubmissionForDelivery,
  releaseSubmissionEmail,
  type SubmissionEmailKind,
} from '@/lib/queries/form-submission-delivery'

import { addToMarketingAudience } from './audience'
import { resolveFormEmailAddresses, resolvePortalOrigin } from './addresses'
import { renderSubmissionEmails } from './render'

/**
 * `sent`    — delivered now, or already delivered by an earlier request.
 * `queued`  — the send failed; the claim was released for the retry sweep.
 * `skipped` — delivery was not requested, or the row is not eligible.
 */
export type SubmissionEmailOutcome = 'sent' | 'queued' | 'skipped'

export type SubmissionEmailOutcomes = {
  team: SubmissionEmailOutcome
  confirmation: SubmissionEmailOutcome
}

const SKIPPED: SubmissionEmailOutcomes = {
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
 * Claim, send, and release on failure. Never throws: a Resend outage must not
 * fail the intake request, because the submission itself is already recorded.
 */
async function sendClaimed(
  id: string,
  kind: SubmissionEmailKind,
  message: RenderedEmail,
  envelope: { from: string; to: string; replyTo: string }
): Promise<{ outcome: SubmissionEmailOutcome; sentNow: boolean }> {
  let claimed = false

  try {
    claimed = await claimSubmissionEmail(id, kind)

    // Lost the claim: another request holds it or already sent it.
    if (!claimed) return { outcome: 'sent', sentNow: false }

    await sendEmail({ ...envelope, ...message })
    return { outcome: 'sent', sentNow: true }
  } catch (error) {
    console.error(`Submission ${kind} email failed`, { id, error })

    if (claimed) {
      await releaseSubmissionEmail(id, kind).catch(releaseError => {
        // The claim is now stuck, so this email will not be retried. The row
        // still flags unread in the portal, which is the backstop.
        console.error(`Unable to release ${kind} email claim`, {
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
 * number of times, from the intake routes and the retry sweep alike.
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
    return SKIPPED
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

  if (!emails) return SKIPPED

  const visitor = row.contactEmail
  const confirmationEmail = emails.confirmation

  const [team, confirmation] = await Promise.all([
    row.teamNotifiedAt
      ? ('sent' as const)
      : sendClaimed(id, 'team', emails.team, {
          from,
          to: teamInbox,
          replyTo: visitor,
        }).then(result => result.outcome),
    row.confirmationSentAt
      ? ('sent' as const)
      : confirmationEmail
        ? sendClaimed(id, 'confirmation', confirmationEmail, {
            from,
            to: visitor,
            replyTo: teamInbox,
          }).then(async ({ outcome, sentNow }) => {
            // Tied to winning the confirmation claim so it happens once per
            // submission, not once per replay.
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
