import "server-only";

import {
  magicLinkEmail,
  passwordResetEmail,
  type RenderedEmail,
} from "@pts/email";

import { serverEnv } from "@/lib/env.server";
import { sendEmail } from "@/lib/email/send";

/**
 * Matches `otp_expiry` in `supabase/config.toml` (3600s). The templates state
 * the window in words, so a drift here makes the mail lie about how long the
 * recipient has.
 */
const LINK_EXPIRY_MINUTES = 60;

/** How the internal app refers to itself in mail — not the client portal. */
const DESTINATION = "the Place To Stand internal portal";

type AuthEmailTemplate = (args: {
  actionLink: string;
  destination: string;
  expiresInMinutes: number;
  replyTo: string;
}) => RenderedEmail;

export async function sendPasswordResetEmail(to: string, actionLink: string) {
  await send(to, actionLink, passwordResetEmail);
}

export async function sendMagicLinkEmail(to: string, actionLink: string) {
  await send(to, actionLink, magicLinkEmail);
}

async function send(
  to: string,
  actionLink: string,
  template: AuthEmailTemplate
) {
  const email = template({
    actionLink,
    destination: DESTINATION,
    expiresInMinutes: LINK_EXPIRY_MINUTES,
    replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
  });

  await sendEmail({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    to,
    replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}
