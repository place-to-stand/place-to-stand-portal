import 'server-only'

import {
  adminInviteEmail,
  portalInviteEmail,
  type RenderedEmail,
} from '@pts/email'

import { serverEnv } from '@/lib/env.server'
import { getEmailSender } from '@/lib/business/identity'
import { sendEmail } from '@/lib/email/send'

/** Matches `otp_expiry` in `supabase/config.toml` (3600s). */
const LINK_EXPIRY_MINUTES = 60

type SendPortalInviteArgs = {
  to: string
  fullName?: string | null
  actionLink: string
}

/** Client portal invite: a one-time sign-in link into the client portal. */
export async function sendPortalInviteEmail({
  to,
  fullName,
  actionLink,
}: SendPortalInviteArgs) {
  const sender = await getEmailSender()
  await send(
    to,
    sender,
    portalInviteEmail({
      fullName,
      actionLink,
      signInUrl: `${serverEnv.CLIENT_PORTAL_URL}/sign-in`,
      expiresInMinutes: LINK_EXPIRY_MINUTES,
      replyTo: sender.replyTo,
      brand: sender.brand,
    })
  )
}

type SendAdminInviteArgs = {
  to: string
  fullName?: string | null
  temporaryPassword: string
  /** Base URL of the admin app — NOT the client portal. */
  baseUrl: string
}

/** Admin invite: a temporary password, reset on first sign-in. */
export async function sendAdminInviteEmail({
  to,
  fullName,
  temporaryPassword,
  baseUrl,
}: SendAdminInviteArgs) {
  const sender = await getEmailSender()
  await send(
    to,
    sender,
    adminInviteEmail({
      email: to,
      fullName,
      temporaryPassword,
      signInUrl: `${baseUrl}/sign-in`,
      replyTo: sender.replyTo,
      brand: sender.brand,
    })
  )
}

async function send(
  to: string,
  { from, replyTo }: { from: string; replyTo: string },
  { subject, text, html }: RenderedEmail
) {
  await sendEmail({
    from,
    to,
    replyTo,
    subject,
    text,
    html,
  })
}
