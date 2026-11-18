import 'server-only'

import { serverEnv } from '@/lib/env.server'

/**
 * Resend refuses mail from a domain it hasn't verified, and every email the
 * portal sends would fail with it. So a new sending address is checked before
 * it is saved: its domain must be one the portal already sends from, or one
 * Resend lists as verified. Returns the error to show, or null.
 *
 * Outside production mail goes to Mailpit, which takes any sender.
 */
export async function checkSendingAddress(
  address: string
): Promise<string | null> {
  if (process.env.NODE_ENV !== 'production') return null

  const domain = domainOf(address)
  if (!domain) return 'Enter an email address.'

  const knownDomains = [
    serverEnv.RESEND_FROM_EMAIL,
    serverEnv.RESEND_FORMS_FROM_EMAIL,
  ].flatMap(value => (value ? [domainOf(value)] : []))
  if (knownDomains.includes(domain)) return null

  let response: Response
  try {
    response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${serverEnv.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return `Resend couldn't be reached to check ${domain}. Try again in a moment.`
  }

  const fallback = knownDomains[0]
  if (response.status === 401 || response.status === 403) {
    // A sending-only key can't list domains: stick to the one we know works.
    return fallback
      ? `Use an address at ${fallback}, the domain this portal sends from. To send from ${domain}, verify it in Resend and use a full-access API key.`
      : `${domain} couldn't be checked in Resend.`
  }
  if (!response.ok) {
    return `Resend couldn't check ${domain} (HTTP ${response.status}). Try again in a moment.`
  }

  const body = (await response.json().catch(() => null)) as {
    data?: { name?: string; status?: string }[]
  } | null
  const match = body?.data?.find(entry => entry.name?.toLowerCase() === domain)
  if (!match)
    return `${domain} isn't set up in Resend yet. Add and verify it there first.`
  if (match.status !== 'verified') {
    return `${domain} isn't verified in Resend yet (${match.status ?? 'pending'}).`
  }
  return null
}

function domainOf(address: string): string | null {
  const at = address.lastIndexOf('@')
  return at > 0
    ? address
        .slice(at + 1)
        .trim()
        .toLowerCase()
    : null
}
