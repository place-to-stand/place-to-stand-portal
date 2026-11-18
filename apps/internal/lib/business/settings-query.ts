import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { DEFAULT_TIME_ZONE } from '@pts/db/business'
import { businessSettings, companies } from '@pts/db/schema'

import { db } from '@/lib/db'

import { businessImageSrc } from './images'

/** What the Business page form starts from: the stored values, no fallbacks. */
export type BusinessSettingsFormData = {
  name: string
  legalName: string
  website: string
  addressLine1: string
  addressLine2: string
  city: string
  region: string
  postalCode: string
  country: string
  phone: string
  inboxEmail: string
  sendingEmail: string
  bookingUrl: string
  timeZone: string
  logoSrc: string | null
  iconSrc: string | null
  confirmedAt: string | null
}

export async function loadBusinessSettingsForm(): Promise<BusinessSettingsFormData> {
  const [[staff], [row]] = await Promise.all([
    db
      .select({ name: companies.name })
      .from(companies)
      .where(and(eq(companies.isStaff, true), isNull(companies.deletedAt)))
      .limit(1),
    db
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
      .limit(1),
  ])

  return {
    name: staff?.name ?? '',
    legalName: row?.legalName ?? '',
    website: row?.website ?? '',
    addressLine1: row?.addressLine1 ?? '',
    addressLine2: row?.addressLine2 ?? '',
    city: row?.city ?? '',
    region: row?.region ?? '',
    postalCode: row?.postalCode ?? '',
    country: row?.country ?? '',
    phone: row?.phone ?? '',
    inboxEmail: row?.inboxEmail ?? '',
    sendingEmail: row?.sendingEmail ?? '',
    bookingUrl: row?.bookingUrl ?? '',
    timeZone: row?.timeZone ?? DEFAULT_TIME_ZONE,
    logoSrc: businessImageSrc(
      'logo',
      row?.hasLogo ?? false,
      row?.updatedAt ?? null
    ),
    iconSrc: businessImageSrc(
      'icon',
      row?.hasIcon ?? false,
      row?.updatedAt ?? null
    ),
    confirmedAt: row?.confirmedAt ?? null,
  }
}
