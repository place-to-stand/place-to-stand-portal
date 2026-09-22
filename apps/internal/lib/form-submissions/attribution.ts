/**
 * One-line "where did this come from" summary for a submission.
 *
 * The team notification email, the Submissions table's Source column, and the
 * detail sheet all call this, so the three can never describe the same row
 * differently. Pure on purpose: no env, no dates, no DB types beyond the eight
 * attribution fields.
 */

export type AttributionChannel =
  'paid' | 'organic' | 'referral' | 'social' | 'email' | 'campaign' | 'direct'

export type AttributionInput = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  gclid: string | null
  referrer: string | null
}

export type AttributionSummary = {
  channel: AttributionChannel
  /** Human-readable, e.g. `Google Ads · brand-search · "shopify agency"`. */
  label: string
  /**
   * The label minus anything a channel badge already says, for UI that shows
   * both: `google.com` rather than `Organic · google.com`. Null for direct.
   */
  detail: string | null
}

export const ATTRIBUTION_CHANNEL_LABELS: Record<AttributionChannel, string> = {
  paid: 'Paid',
  organic: 'Organic',
  referral: 'Referral',
  social: 'Social',
  email: 'Email',
  campaign: 'Campaign',
  direct: 'Direct',
}

const PAID_MEDIUMS = new Set([
  'cpc',
  'ppc',
  'paid',
  'paidsearch',
  'paid-search',
  'paid_search',
  'paidsocial',
  'paid-social',
  'paid_social',
  'display',
  'cpm',
  'ads',
])
const SOCIAL_MEDIUMS = new Set(['social', 'organic-social', 'organic_social'])
const EMAIL_MEDIUMS = new Set(['email', 'newsletter', 'e-mail'])

const SEARCH_HOSTS = [
  'google.',
  'bing.com',
  'duckduckgo.com',
  'yahoo.',
  'ecosia.org',
  'brave.com',
  'kagi.com',
  'perplexity.ai',
]
const SOCIAL_HOSTS = [
  'linkedin.com',
  'lnkd.in',
  'facebook.com',
  'instagram.com',
  't.co',
  'twitter.com',
  'x.com',
  'reddit.com',
  'threads.net',
  'youtube.com',
  'tiktok.com',
]

const OWN_HOSTS = ['placetostandagency.com']

/** Friendly names for sources that arrive as lowercase ad-platform slugs. */
const SOURCE_NAMES: Record<string, string> = {
  google: 'Google',
  bing: 'Bing',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  meta: 'Meta',
  instagram: 'Instagram',
  twitter: 'X',
  x: 'X',
  reddit: 'Reddit',
  youtube: 'YouTube',
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function referrerHost(referrer: string | null): string | null {
  const value = clean(referrer)
  if (!value) return null

  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase() || null
  } catch {
    // Not a URL (some browsers send an origin-less string): show it as-is.
    return value.toLowerCase()
  }
}

function hostMatches(host: string, patterns: string[]): boolean {
  return patterns.some(pattern =>
    pattern.endsWith('.')
      ? host.startsWith(pattern) || host.includes(`.${pattern}`)
      : host === pattern || host.endsWith(`.${pattern}`)
  )
}

function joinParts(parts: Array<string | null>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

export function describeAttribution(
  input: AttributionInput
): AttributionSummary {
  const source = clean(input.utmSource)
  const medium = clean(input.utmMedium)?.toLowerCase() ?? null
  const campaign = clean(input.utmCampaign)
  const term = clean(input.utmTerm)
  const gclid = clean(input.gclid)
  const host = referrerHost(input.referrer)

  const sourceName = source
    ? (SOURCE_NAMES[source.toLowerCase()] ?? source)
    : null
  const quotedTerm = term ? `"${term}"` : null

  // A gclid means a Google Ads click even when the UTMs were stripped.
  if (gclid || (medium && PAID_MEDIUMS.has(medium))) {
    const platform = sourceName
      ? `${sourceName} Ads`
      : gclid
        ? 'Google Ads'
        : 'Paid'
    const label = joinParts([platform, campaign, quotedTerm])
    return { channel: 'paid', label, detail: label }
  }

  if (source || medium || campaign) {
    const channel: AttributionChannel =
      medium && EMAIL_MEDIUMS.has(medium)
        ? 'email'
        : medium && SOCIAL_MEDIUMS.has(medium)
          ? 'social'
          : 'campaign'

    const label = joinParts([sourceName ?? medium, campaign, quotedTerm])
    return { channel, label, detail: label }
  }

  // An internal navigation is not a source: the visitor was already on the site.
  if (host && !hostMatches(host, OWN_HOSTS)) {
    if (hostMatches(host, SEARCH_HOSTS)) {
      return { channel: 'organic', label: `Organic · ${host}`, detail: host }
    }
    if (hostMatches(host, SOCIAL_HOSTS)) {
      return { channel: 'social', label: `Social · ${host}`, detail: host }
    }
    return { channel: 'referral', label: `Referral · ${host}`, detail: host }
  }

  return { channel: 'direct', label: 'Direct', detail: null }
}
