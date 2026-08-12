/**
 * Delivery for transactional mail.
 *
 * Uses Resend's HTTP API rather than its SDK so this package stays
 * dependency-free and both apps can send without adding one. The internal app
 * keeps its own SDK-based sender for the invite path; consolidating the two is
 * a follow-up, not a prerequisite.
 */

export type OutboundEmail = {
  from: string
  to: string
  replyTo?: string
  subject: string
  text: string
  html: string
}

export type TransportConfig =
  /** Deployed: real delivery through Resend. */
  | { mode: 'resend'; apiKey: string }
  /**
   * Local: Supabase runs Mailpit, so mail is visible without a verified sender
   * domain. Without this, every local send fails with a Resend 403 — and since
   * a failed invite rolls the whole account creation back, the flow becomes
   * untestable end to end.
   */
  | { mode: 'mailpit'; url?: string }

const DEFAULT_MAILPIT_URL = 'http://127.0.0.1:54324'

export async function sendEmail(
  message: OutboundEmail,
  config: TransportConfig
): Promise<void> {
  if (config.mode === 'resend') {
    await sendViaResend(message, config.apiKey)
    return
  }

  await sendViaMailpit(message, config.url ?? DEFAULT_MAILPIT_URL)
}

async function sendViaResend(
  message: OutboundEmail,
  apiKey: string
): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: message.from,
      to: message.to,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })

  if (!response.ok) {
    // The body carries the actual reason — unverified sender domain, bad key,
    // rate limit — and losing it turns every failure into the same mystery.
    throw new Error(
      `Resend rejected the message (HTTP ${response.status}): ${await response.text()}`
    )
  }
}

async function sendViaMailpit(
  message: OutboundEmail,
  mailpitUrl: string
): Promise<void> {
  let response: Response

  try {
    response = await fetch(`${mailpitUrl}/api/v1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: parseAddress(message.from),
        To: [{ Email: message.to }],
        ...(message.replyTo ? { ReplyTo: [{ Email: message.replyTo }] } : {}),
        Subject: message.subject,
        Text: message.text,
        HTML: message.html,
      }),
    })
  } catch (cause) {
    // Explicit rather than silent: a caller that rolls back on send failure
    // should not be left guessing whether the mail server was simply down.
    throw new Error(
      `Unable to reach Mailpit at ${mailpitUrl}. Is local Supabase running?`,
      { cause }
    )
  }

  if (!response.ok) {
    throw new Error(
      `Mailpit rejected the message (HTTP ${response.status}): ${await response.text()}`
    )
  }
}

/** Splits `Name <addr@host>` into Mailpit's address shape. */
function parseAddress(value: string): { Email: string; Name?: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)

  if (!match) {
    return { Email: value.trim() }
  }

  const [, name, email] = match
  return name ? { Email: email, Name: name } : { Email: email }
}
