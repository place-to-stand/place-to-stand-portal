import 'server-only'

import { sql } from 'drizzle-orm'

import { personAvatarSql, personNameSql } from '@pts/db/names'
import { businessSettings, users } from '@pts/db/schema'

import { db } from '@/lib/db'
import { eligiblePartner } from '@/lib/queries/reports/profit-share-partners'

/** A staff sign-in the profit share can be split with. */
export type ProfitShareStaff = {
  id: string
  name: string
  email: string
  hasPhoto: boolean
}

/** What the Profit share form (Settings → Billing) starts from. */
export type ProfitShareFormData = {
  /** YYYY-MM, or empty while the profit share is off. */
  profitShareStartMonth: string
  profitShareMinimumBalance: string
  profitSharePartnerIds: string[]
  /** Staff who can be picked as partners. */
  staff: ProfitShareStaff[]
}

const staffName = sql<string>`coalesce(nullif(${personNameSql}, ''), ${users.email})`

export async function loadProfitShareForm(): Promise<ProfitShareFormData> {
  const [[row], staffUsers] = await Promise.all([
    db
      .select({
        startsOn: businessSettings.profitShareStartsOn,
        minimumBalance: businessSettings.profitShareMinimumBalance,
        partnerIds: businessSettings.profitSharePartnerIds,
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

  const partnerIds = row?.partnerIds ?? []
  return {
    profitShareStartMonth: row?.startsOn?.slice(0, 7) ?? '',
    profitShareMinimumBalance: formatAmount(row?.minimumBalance),
    // An archived partner is left out, as the monthly close leaves them out.
    profitSharePartnerIds: partnerIds.filter(id =>
      staffUsers.some(user => user.id === id)
    ),
    staff: staffUsers,
  }
}

/** "10000.00" as "10000"; zero as empty, so the field shows its hint. */
function formatAmount(value: string | null | undefined): string {
  const amount = Number(value ?? 0)
  if (!amount) return ''
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}
