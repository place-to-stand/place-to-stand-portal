import type { EmailBlock, EmailDetailRow } from '../blocks'

/**
 * Pieces shared by the two team notifications (contact + audit), so both read
 * the same way: who, what they said, where they came from, have we seen them.
 *
 * Every value is a plain string resolved by the caller. This package carries
 * no database or validation types.
 */

export type SubmissionContact = {
  name: string
  email: string
  company: string | null
  website: string | null
}

export type SubmissionSource = {
  /** One-line summary, e.g. `Google Ads · brand-search · "shopify agency"`. */
  summary: string
  landingPath: string | null
  /** e.g. `Desktop · 1440px`. */
  device: string | null
  timezone: string | null
  replayUrl: string | null
}

export type SubmissionRepeat = {
  /** How many submissions this address has made, counting this one. */
  count: number
  /** Portal link to the lead that already carries this address, if any. */
  leadUrl: string | null
}

export function ordinal(value: number): string {
  const tens = value % 100
  if (tens >= 11 && tens <= 13) return `${value}th`
  const suffix = ['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'
  return `${value}${suffix}`
}

/** `Jane Doe · Acme` — the identity half of a team subject line. */
export function identityLine(contact: SubmissionContact): string {
  return contact.company ? `${contact.name} · ${contact.company}` : contact.name
}

export function contactRows(contact: SubmissionContact): EmailDetailRow[] {
  const rows: EmailDetailRow[] = [
    { label: 'Name', value: contact.name },
    { label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
  ]

  if (contact.company) {
    rows.push({ label: 'Company', value: contact.company })
  }

  if (contact.website) {
    rows.push({
      label: 'Website',
      value: contact.website,
      // Visitor-typed, so only link what is unambiguously a web URL.
      href: /^https?:\/\//i.test(contact.website) ? contact.website : undefined,
    })
  }

  return rows
}

export function sourceBlocks(
  source: SubmissionSource,
  repeat: SubmissionRepeat | null
): EmailBlock[] {
  const rows: EmailDetailRow[] = [{ label: 'Source', value: source.summary }]

  if (source.landingPath) {
    rows.push({ label: 'Landed on', value: source.landingPath })
  }

  const device = [source.device, source.timezone].filter(Boolean).join(' · ')
  if (device) {
    rows.push({ label: 'Device', value: device })
  }

  if (source.replayUrl) {
    rows.push({
      label: 'Replay',
      value: 'Watch the session in PostHog',
      href: source.replayUrl,
    })
  }

  if (repeat && repeat.count > 1) {
    rows.push({
      label: 'History',
      value: `${ordinal(repeat.count)} submission from this email`,
    })
  }

  if (repeat?.leadUrl) {
    rows.push({
      label: 'Lead',
      value: 'Already on the leads board',
      href: repeat.leadUrl,
    })
  }

  return [{ type: 'label', text: 'Where they came from' }, { type: 'rows', rows }]
}
