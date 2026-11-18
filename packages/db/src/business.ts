import { eq, sql } from 'drizzle-orm'

import type { DbClient } from './client'
import { businessSettings, companies } from './schema'

/**
 * The install's own business, read in one place by both apps (emails, PDFs,
 * share pages, dates). The name comes from the staff company; everything else
 * from the one `business_settings` row (migration 0137).
 *
 * A database before 0137, or with no row yet, still renders: the name falls
 * back to the product's, and every other field is left empty. No install
 * starts with another business's contact details.
 */

export const DEFAULT_BUSINESS_NAME = 'Place To Stand'
export const DEFAULT_TIME_ZONE = 'America/Chicago'

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
  /** The address as printed lines (`formatAddressLines`); empty when none. */
  addressLines: string[]
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
    website: null,
    websiteLabel: null,
    address: {
      line1: null,
      line2: null,
      city: null,
      region: null,
      postalCode: null,
      country: null,
    },
    addressLines: [],
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

/** The staff company's name, archived or not: it is still the business. */
async function readStaffCompanyName(db: DbClient): Promise<string | null> {
  const [row] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.isStaff, true))
    .orderBy(sql`${companies.deletedAt} is not null`)
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
  const address: BusinessAddress = {
    line1: blank(row.addressLine1),
    line2: blank(row.addressLine2),
    city: blank(row.city),
    region: blank(row.region),
    postalCode: blank(row.postalCode),
    country: blank(row.country),
  }
  return {
    name,
    legalName: blank(row.legalName) ?? name,
    website,
    websiteLabel: websiteLabel(website),
    address,
    addressLines: formatAddressLines(address),
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

/**
 * Postgres 42P01 (undefined table) or 42703 (undefined column): a database
 * not yet migrated. Drizzle wraps it, so check the cause.
 */
function isMissingRelation(error: unknown): boolean {
  for (let current: unknown = error; current;) {
    if (
      typeof current === 'object' &&
      current !== null &&
      'code' in current &&
      ['42P01', '42703'].includes(String((current as { code?: unknown }).code))
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

/** The partner profit share as set on Settings → Billing. */
export type ProfitSharePolicy = {
  /** First month (YYYY-MM-01) it applies to. */
  startsOn: string
  minimumBalance: number
  /** Users who split it, in the order picked. */
  partnerIds: string[]
}

/**
 * The profit share, or null when it is off: no start month, no partners, or
 * a database before migration 0137.
 */
export async function readProfitSharePolicy(
  db: DbClient
): Promise<ProfitSharePolicy | null> {
  try {
    const [row] = await db
      .select({
        startsOn: businessSettings.profitShareStartsOn,
        minimumBalance: businessSettings.profitShareMinimumBalance,
        partnerIds: businessSettings.profitSharePartnerIds,
      })
      .from(businessSettings)
      .limit(1)
    if (!row?.startsOn || row.partnerIds.length === 0) return null
    return {
      startsOn: `${row.startsOn.slice(0, 7)}-01`,
      minimumBalance: Number(row.minimumBalance),
      partnerIds: row.partnerIds,
    }
  } catch (error) {
    if (isMissingRelation(error)) return null
    throw error
  }
}
