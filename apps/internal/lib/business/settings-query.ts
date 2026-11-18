import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { DEFAULT_TIME_ZONE } from '@pts/db/business'
import { personAvatarSql, personNameSql } from '@pts/db/names'
import { businessSettings, companies, users } from '@pts/db/schema'

import { db } from '@/lib/db'
import { eligiblePartner } from '@/lib/queries/reports/profit-share-partners'

import { businessImageSrc } from './images'

/** A staff sign-in the profit share can be split with. */
export type ProfitShareStaff = {
  id: string
  name: string
  email: string
  hasPhoto: boolean
}

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
  /** YYYY-MM, or empty while the profit share is off. */
  profitShareStartMonth: string
  profitShareMinimumBalance: string
  profitSharePartnerIds: string[]
  /** Staff who can be picked as profit-share partners. */
  staff: ProfitShareStaff[]
  logoSrc: string | null
  iconSrc: string | null
  confirmedAt: string | null
}

const staffName = sql<string>`coalesce(nullif(${personNameSql}, ''), ${users.email})`

export async function loadBusinessSettingsForm(): Promise<BusinessSettingsFormData> {
  const [[staff], [row], staffUsers] = await Promise.all([
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
        profitShareStartsOn: businessSettings.profitShareStartsOn,
        profitShareMinimumBalance: businessSettings.profitShareMinimumBalance,
        profitSharePartnerIds: businessSettings.profitSharePartnerIds,
        hasLogo: sql<boolean>`${businessSettings.logoDataUrl} is not null`,
        hasIcon: sql<boolean>`${businessSettings.iconDataUrl} is not null`,
        confirmedAt: businessSettings.confirmedAt,
        updatedAt: businessSettings.updatedAt,
      })
      .from(businessSettings)
      .limit(1),
    db
      .select({
        id: users.id,
        name: staffName,
        email: users.email,
        hasPhoto: sql<boolean>`${personAvatarSql} is not null`,
      })
      .from(users)
      .where(eligiblePartner)
      .orderBy(staffName),
  ])

  const partnerIds = row?.profitSharePartnerIds ?? []

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
    profitShareStartMonth: row?.profitShareStartsOn?.slice(0, 7) ?? '',
    profitShareMinimumBalance: formatAmount(row?.profitShareMinimumBalance),
    // An archived partner is left out, as the monthly close leaves them out.
    profitSharePartnerIds: partnerIds.filter(id =>
      staffUsers.some(user => user.id === id)
    ),
    staff: staffUsers,
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

/** "10000.00" as "10000"; zero as empty, so the field shows its hint. */
function formatAmount(value: string | null | undefined): string {
  const amount = Number(value ?? 0)
  if (!amount) return ''
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}
