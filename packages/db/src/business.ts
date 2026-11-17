import { and, eq, isNull, sql } from 'drizzle-orm'

import type { DbClient } from './client'
import { businessSettings, companies } from './schema'

/**
 * The install's own business, read in one place by both apps (emails, PDFs,
 * share pages, dates). The name comes from the staff company; everything else
 * from the one `business_settings` row (migrations 0137 and 0138).
 *
 * Every field has a fallback, so a database before 0137, or a row with blanks,
 * still renders: the fallbacks are Place To Stand's own details, which is what
 * every install starts with anyway.
 */

export const DEFAULT_BUSINESS_NAME = 'Place To Stand'
export const DEFAULT_TIME_ZONE = 'America/Chicago'
const DEFAULT_WEBSITE = 'https://placetostandagency.com'

export type BusinessAddress = {
  line1: string | null
  line2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
}

export type BusinessIdentity = {
  /** Short name: email sender name, wordmark, footers. */
  name: string
  /** Name on invoices; the short name when none is set. */
  legalName: string
  /** Full URL, or null when the business has no site. */
  website: string | null
  /** The website without scheme or trailing slash, for printing. */
  websiteLabel: string | null
  address: BusinessAddress
  phone: string | null
  /** Where replies and notifications go. Null: use the env fallback. */
  inboxEmail: string | null
  /** Address automated mail is sent from. Null: use the env fallback. */
  sendingEmail: string | null
  bookingUrl: string | null
  timeZone: string
  hasLogo: boolean
  hasIcon: boolean
  /** Null until an admin saves the Business page. */
  confirmedAt: string | null
  updatedAt: string | null
}

const blank = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function websiteLabel(url: string | null): string | null {
  if (!url) return null
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

/** The address as printed lines: street, street 2, "City, ST 12345", country. */
export function formatAddressLines(address: BusinessAddress): string[] {
  const cityLine = [
    [address.city, address.region].filter(Boolean).join(', '),
    address.postalCode,
  ]
    .filter(Boolean)
    .join(' ')
  return [address.line1, address.line2, cityLine, address.country].filter(
    (line): line is string => Boolean(line)
  )
}

/** True for a time zone name the runtime can format in. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    // oxlint-disable-next-line no-restricted-properties -- only checks the zone name; formats nothing
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

function fallbackIdentity(name: string): BusinessIdentity {
  return {
    name,
    legalName: name,
    website: DEFAULT_WEBSITE,
    websiteLabel: websiteLabel(DEFAULT_WEBSITE),
    address: {
      line1: null,
      line2: null,
      city: null,
      region: null,
      postalCode: null,
      country: null,
    },
    phone: null,
    inboxEmail: null,
    sendingEmail: null,
    bookingUrl: null,
    timeZone: DEFAULT_TIME_ZONE,
    hasLogo: false,
    hasIcon: false,
    confirmedAt: null,
    updatedAt: null,
  }
}

async function readStaffCompanyName(db: DbClient): Promise<string | null> {
  const [row] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(and(eq(companies.isStaff, true), isNull(companies.deletedAt)))
    .limit(1)
  return blank(row?.name)
}

/**
 * Reads the business. Never throws for a missing table or row (a database not
 * yet migrated to 0137): it returns the fallbacks instead, so email and PDFs
 * keep working during a release.
 */
export async function readBusinessIdentity(
  db: DbClient
): Promise<BusinessIdentity> {
  const name = (await readStaffCompanyName(db)) ?? DEFAULT_BUSINESS_NAME

  let row: Awaited<ReturnType<typeof selectRow>>[number] | undefined
  try {
    ;[row] = await selectRow(db)
  } catch (error) {
    if (isMissingRelation(error)) return fallbackIdentity(name)
    throw error
  }
  if (!row) return fallbackIdentity(name)

  const website = blank(row.website)
  const timeZone = blank(row.timeZone)
  return {
    name,
    legalName: blank(row.legalName) ?? name,
    website,
    websiteLabel: websiteLabel(website),
    address: {
      line1: blank(row.addressLine1),
      line2: blank(row.addressLine2),
      city: blank(row.city),
      region: blank(row.region),
      postalCode: blank(row.postalCode),
      country: blank(row.country),
    },
    phone: blank(row.phone),
    inboxEmail: blank(row.inboxEmail),
    sendingEmail: blank(row.sendingEmail),
    bookingUrl: blank(row.bookingUrl),
    timeZone:
      timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE,
    hasLogo: row.hasLogo,
    hasIcon: row.hasIcon,
    confirmedAt: row.confirmedAt,
    updatedAt: row.updatedAt,
  }
}

function selectRow(db: DbClient) {
  // The images are left out: they are served on their own route.
  return db
    .select({
      legalName: businessSettings.legalName,
      website: businessSettings.website,
      addressLine1: businessSettings.addressLine1,
      addressLine2: businessSettings.addressLine2,
      city: businessSettings.city,
      region: businessSettings.region,
      postalCode: businessSettings.postalCode,
      country: businessSettings.country,
      phone: businessSettings.phone,
      inboxEmail: businessSettings.inboxEmail,
      sendingEmail: businessSettings.sendingEmail,
      bookingUrl: businessSettings.bookingUrl,
      timeZone: businessSettings.timeZone,
      hasLogo: sql<boolean>`${businessSettings.logoDataUrl} is not null`,
      hasIcon: sql<boolean>`${businessSettings.iconDataUrl} is not null`,
      confirmedAt: businessSettings.confirmedAt,
      updatedAt: businessSettings.updatedAt,
    })
    .from(businessSettings)
    .limit(1)
}

/** The stored logo or icon as a data URL, or null when none is uploaded. */
export async function readBusinessImage(
  db: DbClient,
  kind: 'logo' | 'icon'
): Promise<string | null> {
  try {
    const [row] = await db
      .select({
        value:
          kind === 'logo'
            ? businessSettings.logoDataUrl
            : businessSettings.iconDataUrl,
      })
      .from(businessSettings)
      .limit(1)
    return row?.value ?? null
  } catch (error) {
    if (isMissingRelation(error)) return null
    throw error
  }
}

/** Postgres 42P01: undefined table. Drizzle wraps it, so check the cause. */
function isMissingRelation(error: unknown): boolean {
  for (let current: unknown = error; current;) {
    if (
      typeof current === 'object' &&
      current !== null &&
      'code' in current &&
      (current as { code?: unknown }).code === '42P01'
    ) {
      return true
    }
    current =
      typeof current === 'object' && current !== null && 'cause' in current
        ? (current as { cause?: unknown }).cause
        : undefined
  }
  return false
}
