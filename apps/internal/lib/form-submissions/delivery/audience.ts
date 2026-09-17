import 'server-only'

import { getResendClient } from '@/lib/email/resend'
import { serverEnv } from '@/lib/env.server'

/**
 * Adds a consenting visitor to the Resend marketing audience.
 *
 * Best-effort by contract: it never throws, because a marketing list is not
 * worth failing (or retrying) a lead notification over. Production only, since
 * every other environment sends through Mailpit and has no audience to add to.
 *
 * Callers must only reach this with explicit opt-in. Replying to an enquiry is
 * not consent to marketing.
 */
export async function addToMarketingAudience({
  email,
  name,
}: {
  email: string
  name: string | null
}): Promise<void> {
  const audienceId = serverEnv.RESEND_AUDIENCE_ID

  if (!audienceId || process.env.NODE_ENV !== 'production') return

  const [firstName, ...rest] = (name ?? '').trim().split(/\s+/)
  const lastName = rest.join(' ').trim()

  try {
    const { error } = await getResendClient().contacts.create({
      email,
      audienceId,
      unsubscribed: false,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    })

    if (error && !error.message?.toLowerCase().includes('already exists')) {
      console.error('Failed to add contact to Resend audience', error)
    }
  } catch (error) {
    console.error('Resend contact creation failed', error)
  }
}
