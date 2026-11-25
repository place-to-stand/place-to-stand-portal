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

type PitchSignal = { pattern: RegExp; weight: 1 | 2 }

/**
 * Wording that people selling to us use and people hiring us don't.
 *
 * Weight 2 is wording aimed at selling to us (lead lists, "reply stop",
 * a priced package). Weight 1 is cold-email wording a real client could
 * also write ("I'm reaching out", "we help clinics").
 */
const PITCH_SIGNALS: PitchSignal[] = [
  // "Would this list be relevant to your team?"
  {
    pattern:
      /\b(be|is this|sound) (of )?(relevant|of interest|interesting|useful|helpful|valuable) (to|for) (you and )?your (team|business|company|agency|organization)\b/,
    weight: 2,
  },
  // Lead-list sellers.
  {
    pattern:
      /\bsample (records|data|lists?|contacts)\b|\b(happy|glad) to (share|provide|send) (you )?(a few |some )?(examples|samples)\b/,
    weight: 2,
  },
  // "We also offer SEO and marketing services".
  {
    pattern:
      /\b(we|our team) (also )?(offer|provide)s? [^.\n]{0,60}\b(seo|marketing|lead generation|link building|outsourcing|staffing|billing|credentialing|bookkeeping|virtual assistant)\b[^.\n]{0,30}\bservices\b/,
    weight: 2,
  },
  // A priced product: "the $49 package", "our $199 report".
  {
    pattern: /\$\s?\d[\d,]*[^\n]{0,40}\b(package|report|bundle)\b/,
    weight: 2,
  },
  // Opt-out lines: "reply STOP", "email us with stop", "not at this time".
  {
    pattern:
      /\b(reply|respond|email [^\n]{0,40}) (with )?["“']?(stop|unsubscribe)\b|["“']not (interested|at this time)["”']|\badvertisement\b/,
    weight: 2,
  },
  { pattern: /\b(first page|top) of google\b/, weight: 2 },

  { pattern: /\b(i'?m|i am) reaching out\b|\breaching out to\b/, weight: 1 },
  {
    pattern:
      /\bi hope (you'?re|you are|this (email|message|note) finds you) (doing )?well\b/,
    weight: 1,
  },
  {
    pattern:
      /\bwe help [a-z ]{0,30}(businesses|companies|brands|agencies|organizations|providers|practices|teams)\b/,
    weight: 1,
  },
  { pattern: /\b(companies|businesses) (using|that use)\b/, weight: 1 },
  { pattern: /\bwould you be (open|interested)\b/, weight: 1 },
  { pattern: /\b(hi|hello) dear\b/, weight: 1 },
  {
    pattern:
      /\bour [^.\n]{0,60}\b(report|platform|software|product|tool) (provides|helps|offers)\b/,
    weight: 1,
  },
]

/** At least this much in total, and at least one weight-2 signal. */
const PITCH_THRESHOLD = 3

function normalize(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
}

/**
 * True when the subject and message read like a pitch. Needs a weight-2
 * signal, so cold-email politeness on its own ("I hope you're well, I'm
 * reaching out, we help clinics...") never flags a real enquiry.
 */
export function looksLikeSalesPitch({
  subject,
  message,
}: {
  subject?: string | null
  message?: string | null
}): boolean {
  const text = normalize(`${subject ?? ''}\n${message ?? ''}`)
  if (!text) return false

  let score = 0
  let strong = false
  for (const { pattern, weight } of PITCH_SIGNALS) {
    if (pattern.test(text)) {
      score += weight
      if (weight === 2) strong = true
    }
  }

  return strong && score >= PITCH_THRESHOLD
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
