import 'server-only'

import { cache } from 'react'
import { connection } from 'next/server'

import { readBusinessIdentity, type BusinessIdentity } from '@pts/db/business'
import { emailBrandFor, formatSender } from '@pts/email'
import { invoiceIssuerFor } from '@pts/pdf'
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

/**
 * Where replies go: the Business page's inbox email. With none set, replies
 * go back to the address the mail came from.
 */
export function replyToFor(identity: BusinessIdentity): string {
  return identity.inboxEmail ?? sendingAddressFor(identity)
}

function sendingAddressFor(identity: BusinessIdentity): string {
  return identity.sendingEmail ?? serverEnv.RESEND_FROM_EMAIL
}

/** `Name <address>` for automated mail. */
export function fromAddressFor(identity: BusinessIdentity): string {
  return formatSender(identity.name, sendingAddressFor(identity))
}

/** Sender, reply-to and brand for one outbound email, in one read. */
export async function getEmailSender() {
  const identity = await getBusinessIdentity()
  return {
    from: fromAddressFor(identity),
    replyTo: replyToFor(identity),
    inboxEmail: identity.inboxEmail,
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
 * For the root layout, which renders every page: the defaults rather than an
 * error when the database is away.
 */
export async function getBusinessIdentityOrDefaults(): Promise<BusinessIdentity | null> {
  // Every page shows the business, so none is built ahead of time (a build
  // has no database): each renders per request with the saved details.
  await connection()
  try {
    return await getBusinessIdentity()
  } catch (error) {
    console.error('Business settings could not be read; using defaults.', error)
    return null
  }
}

// One shape for every app, built in @pts/email and @pts/pdf.
export { emailBrandFor, invoiceIssuerFor }
