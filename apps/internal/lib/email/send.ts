import "server-only";

import { getResendClient } from "@/lib/email/resend";

export type OutboundEmail = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Local Supabase runs Mailpit on this port. `supabase/config.toml` leaves
 * `smtp_port` commented out, so its HTTP send API is used instead — no SMTP
 * client, and therefore no new dependency.
 */
const MAILPIT_URL = "http://127.0.0.1:54324";

/**
 * Sends through Resend when deployed, and into Mailpit when running locally.
 *
 * Local development has no verified Resend sender domain, so every send used to
 * fail with a 403 that surfaced as "unable to send invite email" — and because
 * `createPortalUser` treats a failed invite as a failed operation, the whole
 * account creation rolled back. Routing local mail to Mailpit makes the flow
 * testable end to end and puts the invite next to Supabase's own emails.
 */
export async function sendEmail(message: OutboundEmail): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    await sendViaResend(message);
    return;
  }

  await sendViaMailpit(message);
}

async function sendViaResend(message: OutboundEmail): Promise<void> {
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: message.from,
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  if (error) {
    throw error;
  }
}

async function sendViaMailpit(message: OutboundEmail): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${MAILPIT_URL}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: parseAddress(message.from),
        To: [{ Email: message.to }],
        ...(message.replyTo
          ? { ReplyTo: [{ Email: message.replyTo }] }
          : {}),
        Subject: message.subject,
        Text: message.text,
        HTML: message.html,
      }),
    });
  } catch (cause) {
    // Explicit rather than silent: a caller that rolls back on send failure
    // should not be left guessing whether the mail server was simply down.
    throw new Error(
      `Unable to reach Mailpit at ${MAILPIT_URL}. Is local Supabase running?`,
      { cause }
    );
  }

  if (!response.ok) {
    throw new Error(
      `Mailpit rejected the message (HTTP ${response.status}): ${await response.text()}`
    );
  }
}

/** Splits `Name <addr@host>` into Mailpit's address shape. */
function parseAddress(value: string): { Email: string; Name?: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);

  if (!match) {
    return { Email: value.trim() };
  }

  const [, name, email] = match;
  return name ? { Email: email, Name: name } : { Email: email };
}
