import 'server-only'

import { cache } from 'react'
import { connection } from 'next/server'

import { readBusinessIdentity, type BusinessIdentity } from '@pts/db/business'
import { emailBrandFor } from '@pts/email'
import { invoiceIssuerFor } from '@pts/pdf'
import { setCompanyTimeZone } from '@placetostand/ui/dates'

import { db } from '@/lib/db'
import { getEnv } from '@/lib/env.server'

/**
 * The business behind this install (internal portal → Settings → Business),
 * for the client portal's header, emails, invoice PDFs and dates. Kept for a
 * minute per process, like the internal portal's copy.
 */

const TTL_MS = 60_000
let memo: { value: BusinessIdentity; at: number } | null = null

export const getBusiness = cache(async (): Promise<BusinessIdentity> => {
  if (!memo || Date.now() - memo.at > TTL_MS) {
    memo = { value: await readBusinessIdentity(db), at: Date.now() }
  }
  setCompanyTimeZone(memo.value.timeZone)
  return memo.value
})

/** For the root layout: null instead of an error when the database is away. */
export async function getBusinessOrNull(): Promise<BusinessIdentity | null> {
  // Every page shows the business, so none is built ahead of time (a build
  // has no database): each renders per request with the saved details.
  await connection()
  try {
    return await getBusiness()
  } catch (error) {
    console.error('Business settings could not be read; using defaults.', error)
    return null
  }
}

/**
 * Props for `BrandLogo`. The images are served by the internal portal, which
 * owns the upload.
 */
export function brandPropsFor(identity: BusinessIdentity) {
  const origin = getEnv().INTERNAL_PORTAL_URL.replace(/\/+$/, '')
  const version = identity.updatedAt
    ? `?v=${encodeURIComponent(identity.updatedAt)}`
    : ''
  return {
    name: identity.name,
    logoSrc: identity.hasLogo
      ? `${origin}/api/public/business/logo${version}`
      : null,
    iconSrc: identity.hasIcon
      ? `${origin}/api/public/business/icon${version}`
      : null,
  }
}

// One shape for every app, built in @pts/email and @pts/pdf.
export { emailBrandFor, invoiceIssuerFor }
