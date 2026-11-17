import 'server-only'

import { cache } from 'react'

import { readBusinessIdentity, type BusinessIdentity } from '@pts/db/business'
import { formatSender, type EmailBrand } from '@pts/email'
import type { InvoiceIssuer } from '@pts/pdf'
import { setCompanyTimeZone } from '@pts/ui/dates'

import { db } from '@/lib/db'
import { serverEnv } from '@/lib/env.server'

import { businessImageSrc } from './images'

/**
 * The install's business (Settings → Business), for everything the portal
 * prints about it: email senders, invoices, share pages, the time zone.
 *
 * Every page reads it (the root layout sets the time zone), so a process keeps
 * it for a minute instead of querying on every request. Saving the Business
 * page clears it here; another server instance picks the change up within the
 * minute.
 */

const TTL_MS = 60_000

let memo: { value: BusinessIdentity; at: number } | null = null

export const getBusinessIdentity = cache(
  async (): Promise<BusinessIdentity> => {
    if (!memo || Date.now() - memo.at > TTL_MS) {
      memo = { value: await readBusinessIdentity(db), at: Date.now() }
    }
    setCompanyTimeZone(memo.value.timeZone)
    return memo.value
  }
)

/** Drops the process copy, after a save. */
export function clearBusinessIdentityMemo() {
  memo = null
}

export function emailBrandFor(identity: BusinessIdentity): EmailBrand {
  return {
    name: identity.name,
    siteUrl: identity.website,
    siteLabel: identity.websiteLabel,
  }
}

export function invoiceIssuerFor(identity: BusinessIdentity): InvoiceIssuer {
  return {
    name: identity.name,
    legalName: identity.legalName,
    websiteLabel: identity.websiteLabel,
  }
}

/** Where replies go: the Business inbox, else the env fallback. */
export function replyToFor(identity: BusinessIdentity): string {
  return identity.inboxEmail ?? serverEnv.RESEND_REPLY_TO_EMAIL
}

/** `Name <address>` for automated mail. */
export function fromAddressFor(identity: BusinessIdentity): string {
  const address = identity.sendingEmail ?? serverEnv.RESEND_FROM_EMAIL
  return formatSender(identity.name, address)
}

/** Sender, reply-to and brand for one outbound email, in one read. */
export async function getEmailSender() {
  const identity = await getBusinessIdentity()
  return {
    from: fromAddressFor(identity),
    replyTo: replyToFor(identity),
    brand: emailBrandFor(identity),
  }
}

/** Props for `BrandLogo` / `BrandLockup`: the name plus any uploaded images. */
export function brandPropsFor(identity: BusinessIdentity) {
  return {
    name: identity.name,
    logoSrc: businessImageSrc('logo', identity.hasLogo, identity.updatedAt),
    iconSrc: businessImageSrc('icon', identity.hasIcon, identity.updatedAt),
  }
}

/**
 * For the root layout, which renders every page, including ones built ahead
 * of time without a database: the defaults rather than an error.
 */
export async function getBusinessIdentityOrDefaults(): Promise<BusinessIdentity | null> {
  // Pages built ahead of time have no database to read: use the defaults.
  // oxlint-disable-next-line pts/env-through-schema -- Next sets NEXT_PHASE itself; it is not deploy config
  if (process.env.NEXT_PHASE === 'phase-production-build') return null
  try {
    return await getBusinessIdentity()
  } catch (error) {
    console.error('Business settings could not be read; using defaults.', error)
    return null
  }
}
