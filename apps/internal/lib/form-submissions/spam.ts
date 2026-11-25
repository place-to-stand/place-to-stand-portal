import { z } from 'zod'

/**
 * Spam checks for the website's contact form.
 *
 * A flagged submission is still recorded and still listed, with a Spam badge.
 * It only loses two things: the emails (team notification and visitor
 * confirmation) and its place in the unacknowledged count. "Not spam" on the
 * sheet gives both back except the emails. So every rule here leans towards
 * letting mail through: a missed pitch costs a glance, a hidden lead costs
 * a client.
 *
 * Three checks, first match wins:
 *
 *   honeypot     a hidden field no person sees was filled in (form fillers)
 *   too_fast     the form was sent less than three seconds after it loaded
 *   sales_pitch  the message reads like someone selling to us (see below)
 *
 * `marked` is not a check: it is the reason stored when a person marks a
 * submission as spam by hand.
 */
export const SPAM_REASONS = [
  'honeypot',
  'too_fast',
  'sales_pitch',
  'marked',
] as const
export type SpamReason = (typeof SPAM_REASONS)[number]

export const SPAM_REASON_LABELS: Record<SpamReason, string> = {
  honeypot: 'Filled in a hidden field',
  too_fast: 'Sent within seconds of opening the form',
  sales_pitch: 'Reads like a sales pitch',
  marked: 'Marked as spam',
}

export function isSpamReason(value: unknown): value is SpamReason {
  return (
    typeof value === 'string' &&
    (SPAM_REASONS as readonly string[]).includes(value)
  )
}

/** Faster than this from page load to send is not a person typing. */
export const MIN_FILL_MS = 3000

/**
 * What the site's browser saw, sent along with a contact submission.
 * Optional, so a site deploy that predates it still lands (and is judged on
 * its wording alone).
 */
export const botSignalsSchema = z.object({
  /** True when the hidden trap field held any text. */
  honeypot: z.boolean(),
  /** Milliseconds from the form loading to the visitor pressing Send. */
  elapsedMs: z.number().int().nonnegative().nullable(),
})
export type BotSignals = z.infer<typeof botSignalsSchema>

/**
 * Wording that people selling to us use and people hiring us almost never
 * do. A message needs TWO different ones to flag: one alone is too easy for
 * a real enquiry to hit ("our budget is $5,000 for the package", "reply STOP
 * to opt out" in an app brief, an agency that offers SEO services and needs
 * a developer). Cold-email politeness ("I'm reaching out", "would you be
 * open to a call") is not on the list at all: real clients write it too.
 *
 * Patterns run on lowercased text with line breaks kept, so a match never
 * spans two lines of a pasted brief.
 */
const PITCH_SIGNALS: RegExp[] = [
  // "Would information on companies using X be relevant to your team?"
  // Data offered TO us. A client asking "would this be of interest to your
  // team?" about their own project doesn't match: it needs data or a list.
  /\b(information|data|lists?|records|contacts) (on|of|about) [^.?\n]{0,60}\b(be|is) (relevant|useful|of interest|valuable) (to|for) your\b/,
  // Lead-list sellers: "sample records", "connect with companies using X".
  /\bsample (records|contacts|leads)\b|\b(connect|reach) (you )?with (companies|businesses|decision[- ]makers)\b|\b(contact|email|lead) (lists?|database)\b/,
  // "Happy to provide a few examples." (A client says "examples OF sites
  // we like", so a trailing "of" doesn't count.)
  /\b(happy|glad) to (share|provide|send) (you )?(a few |some )?(examples|samples)\b(?! of)/,
  // "We also offer SEO and marketing services".
  /\b(we|our team) (also )?(offer|provide)s? [^.\n]{0,60}\b(seo|marketing|lead generation|link building|outsourcing|staffing|billing|credentialing|bookkeeping|virtual assistant)\b[^.\n]{0,30}\bservices\b/,
  // A cheap product for sale: "the $49 package". Under $1,000 only, so a
  // client's budget ("$5,000 for the website package") never matches.
  /(?<!budget[^\n]{0,20})\$\s?\d{1,3}(\.\d\d)?(?![\d,])\b[^\n]{0,40}\b(package|report|bundle)\b/,
  // Marketing-mail footers: "Advertisement.", "To stop marketing from…".
  /(^|\n)advertisement\b|\bto stop (marketing|receiving|these)\b|\bunsubscribe from (these|our|future)\b/,
  // Canned reply prompts: 'A quick reply with "Yes, interested" or "Not at
  // this time" works'.
  /["“']yes,? (i'?m |we'?re )?interested["”']|["“']not (interested|at this time|right now)["”']/,
  /\b(first page|top) of google\b/,
]

/** How many different signals a message needs before it counts. */
const PITCH_THRESHOLD = 2

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim()
}

/** True when the subject and message read like a pitch (see PITCH_SIGNALS). */
export function looksLikeSalesPitch({
  subject,
  message,
}: {
  subject?: string | null
  message?: string | null
}): boolean {
  const text = normalize(`${subject ?? ''}\n${message ?? ''}`)
  if (!text) return false

  let hits = 0
  for (const pattern of PITCH_SIGNALS) {
    if (pattern.test(text)) hits += 1
    if (hits >= PITCH_THRESHOLD) return true
  }
  return false
}

/** The reason to store on a new contact submission, or null for none. */
export function detectContactSpam({
  subject,
  message,
  bot,
}: {
  subject?: string | null
  message?: string | null
  bot?: BotSignals | null
}): SpamReason | null {
  if (bot?.honeypot) return 'honeypot'
  if (bot && bot.elapsedMs !== null && bot.elapsedMs < MIN_FILL_MS) {
    return 'too_fast'
  }
  if (looksLikeSalesPitch({ subject, message })) return 'sales_pitch'
  return null
}
