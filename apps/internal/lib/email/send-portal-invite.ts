import "server-only";

import { serverEnv } from "@/lib/env.server";
import { escapeHtml } from "@/lib/email/escape-html";
import { sendEmail } from "@/lib/email/send";

const SUBJECT = "You're invited to the Place To Stand portal";

/**
 * Client portal invite.
 *
 * Carries a one-time sign-in link rather than a password. The account does have a
 * password credential — generated at create time and never disclosed — so
 * "forgot password" still works as a recovery path for clients who choose a
 * passwordless sign-in method during onboarding.
 */
export type SendPortalInviteArgs = {
  to: string;
  fullName?: string | null;
  actionLink: string;
};

export async function sendPortalInviteEmail({
  to,
  fullName,
  actionLink,
}: SendPortalInviteArgs) {
  const greetingName = fullName?.trim() || "there";

  // The link inherits Supabase's `otp_expiry` (1 hour). Rather than widening that
  // window, the copy points at the sign-in page, where "email me a sign-in link"
  // issues a fresh one — the account already exists by this point.
  const text = [
    `Hi ${greetingName},`,
    "",
    "You've been invited to the Place To Stand client portal.",
    "",
    `Open this link to sign in: ${actionLink}`,
    "",
    "It expires in an hour. If it has, go to",
    `${serverEnv.CLIENT_PORTAL_URL}/sign-in and choose "Email me a sign-in link"`,
    "to get a new one.",
    "",
    "Once you're in, you can choose how you'd like to sign in from then on —",
    "a password, your Google account, or an emailed link each time.",
    "",
    "If you weren't expecting this message, please reach out to hello@placetostandagency.com.",
    "",
    "Talk soon,",
    "The Place To Stand Team",
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #0f172a;">
      <p>Hi ${escapeHtml(greetingName)},</p>
      <p>You've been invited to the Place To Stand client portal.</p>
      <p>
        <a href="${escapeHtml(actionLink)}" style="display: inline-block; padding: 10px 18px; background: #0f172a; color: #ffffff; border-radius: 6px; text-decoration: none;">
          Sign in to the portal
        </a>
      </p>
      <p style="color: #475569; font-size: 14px;">
        This link expires in an hour. If it has, head to
        <a href="${serverEnv.CLIENT_PORTAL_URL}/sign-in">the sign-in page</a> and
        choose &ldquo;Email me a sign-in link&rdquo; for a fresh one.
      </p>
      <p>
        Once you're in, you can choose how you'd like to sign in from then on — a
        password, your Google account, or an emailed link each time.
      </p>
      <p>If you weren't expecting this message, please reach out to <a href="mailto:${serverEnv.RESEND_REPLY_TO_EMAIL}">${serverEnv.RESEND_REPLY_TO_EMAIL}</a>.</p>
      <p>Talk soon,<br />The Place To Stand Team</p>
    </div>
  `;

  await send({ to, text, html });
}

/**
 * Internal admin invite.
 *
 * Unchanged from the original flow: admins get a temporary password and are
 * forced through a password reset by the proxy on first sign-in. Kept separate
 * from the client invite so neither carries a field the other ignores.
 */
export type SendAdminInviteArgs = {
  to: string;
  fullName?: string | null;
  temporaryPassword: string;
  /** Base URL of the internal app — NOT the client portal. */
  baseUrl: string;
};

export async function sendAdminInviteEmail({
  to,
  fullName,
  temporaryPassword,
  baseUrl,
}: SendAdminInviteArgs) {
  const greetingName = fullName?.trim() || "there";

  const text = [
    `Hi ${greetingName},`,
    "",
    "You've been given access to the Place To Stand internal portal.",
    "Use the details below to sign in:",
    "",
    `Email: ${to}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    "For security, you'll be asked to create a new password when you first log in.",
    "",
    `Go to ${baseUrl}/sign-in to get started.`,
    "",
    "If you weren't expecting this message, please reach out to hello@placetostandagency.com.",
    "",
    "Talk soon,",
    "The Place To Stand Team",
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5; color: #0f172a;">
      <p>Hi ${escapeHtml(greetingName)},</p>
      <p>You've been given access to the Place To Stand internal portal. Use the details below to sign in:</p>
      <ul>
        <li><strong>Email:</strong> ${escapeHtml(to)}</li>
        <li><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</li>
      </ul>
      <p>For security, you'll be asked to create a new password when you first log in.</p>
      <p>
        <a href="${escapeHtml(baseUrl)}/sign-in">Sign in to the portal</a> to get started.
      </p>
      <p>If you weren't expecting this message, please reach out to <a href="mailto:${serverEnv.RESEND_REPLY_TO_EMAIL}">${serverEnv.RESEND_REPLY_TO_EMAIL}</a>.</p>
      <p>Talk soon,<br />The Place To Stand Team</p>
    </div>
  `;

  await send({ to, text, html });
}

async function send({
  to,
  text,
  html,
}: {
  to: string;
  text: string;
  html: string;
}) {
  await sendEmail({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    to,
    replyTo: serverEnv.RESEND_REPLY_TO_EMAIL,
    subject: SUBJECT,
    text,
    html,
  });
}
