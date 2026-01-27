import 'server-only'

import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clients,
  contacts,
  hourBlocks,
  projects,
  timeLogs,
  users,
} from '@/lib/db/schema'
import type { MonthCursor } from '@/lib/data/reports/types'

// Constants for billing rates
export const EMPLOYEE_HOURLY_RATE = 100
export const REFERRAL_COMMISSION_PER_HOUR = 20
export const PREPAID_HOURLY_RATE = 200
export const NET_30_HOURLY_RATE = 200

type PayrollQueryRow = {
  userId: string
  fullName: string | null
  email: string
  totalHours: string | null
}

type ReferralQueryRow = {
  referrerId: string
  referrerName: string
  clientId: string
  clientName: string
  hoursPurchased: string | null
}

type PrepaidBillingQueryRow = {
  clientId: string
  clientName: string
  totalHours: string | null
}

type Net30QueryRow = {
  clientId: string
  clientName: string
  totalHours: string | null
}

/**
 * Fetches employee payroll data for ADMIN users who logged time in the given date range.
 * Returns hours logged and calculated pay at EMPLOYEE_HOURLY_RATE.
 */
export async function fetchEmployeePayroll(
  startDate: string,
  endDate: string
): Promise<PayrollQueryRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      totalHours: sql<string | null>`SUM(${timeLogs.hours})`,
    })
    .from(timeLogs)
    .innerJoin(users, eq(timeLogs.userId, users.id))
    .where(
      and(
        eq(users.role, 'ADMIN'),
        isNull(timeLogs.deletedAt),
        isNull(users.deletedAt),
        gte(timeLogs.loggedOn, startDate),
        lte(timeLogs.loggedOn, endDate)
      )
    )
    .groupBy(users.id, users.fullName, users.email)

  return rows as PayrollQueryRow[]
}

/**
 * Fetches referral commission data for prepaid clients with referrals
 * who purchased hour blocks in the given date range.
 * Returns hours purchased and calculated commission at REFERRAL_COMMISSION_PER_HOUR.
 * Includes referrer ID for grouping.
 */
export async function fetchReferralCommissions(
  startDate: string,
  endDate: string
): Promise<ReferralQueryRow[]> {
  // For hour_blocks, we need to filter by created_at in the given month
  // Convert timestamp to date in LA timezone for accurate month boundaries
  const rows = await db
    .select({
      referrerId: contacts.id,
      referrerName: contacts.name,
      clientId: clients.id,
      clientName: clients.name,
      hoursPurchased: sql<string | null>`SUM(${hourBlocks.hoursPurchased})`,
    })
    .from(hourBlocks)
    .innerJoin(clients, eq(hourBlocks.clientId, clients.id))
    .innerJoin(contacts, eq(clients.referredBy, contacts.id))
    .where(
      and(
        eq(clients.billingType, 'prepaid'),
        isNull(hourBlocks.deletedAt),
        isNull(clients.deletedAt),
        isNull(contacts.deletedAt),
        // Convert timestamp to date in LA timezone for month filtering
        sql`DATE(${hourBlocks.createdAt} AT TIME ZONE 'America/Los_Angeles') >= ${startDate}`,
        sql`DATE(${hourBlocks.createdAt} AT TIME ZONE 'America/Los_Angeles') <= ${endDate}`
      )
    )
    .groupBy(contacts.id, contacts.name, clients.id, clients.name)

  return rows as ReferralQueryRow[]
}

/**
 * Fetches billing data for prepaid clients based on hour blocks purchased in the given date range.
 * Returns hours purchased and calculated billing at PREPAID_HOURLY_RATE.
 */
export async function fetchPrepaidBilling(
  startDate: string,
  endDate: string
): Promise<PrepaidBillingQueryRow[]> {
  const rows = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      totalHours: sql<string | null>`SUM(${hourBlocks.hoursPurchased})`,
    })
    .from(hourBlocks)
    .innerJoin(clients, eq(hourBlocks.clientId, clients.id))
    .where(
      and(
        eq(clients.billingType, 'prepaid'),
        isNull(hourBlocks.deletedAt),
        isNull(clients.deletedAt),
        // Convert timestamp to date in LA timezone for month filtering
        sql`DATE(${hourBlocks.createdAt} AT TIME ZONE 'America/Los_Angeles') >= ${startDate}`,
        sql`DATE(${hourBlocks.createdAt} AT TIME ZONE 'America/Los_Angeles') <= ${endDate}`
      )
    )
    .groupBy(clients.id, clients.name)

  return rows as PrepaidBillingQueryRow[]
}

/**
 * Fetches billing data for net_30 clients based on time logged in the given date range.
 * Returns hours logged and calculated billing at NET_30_HOURLY_RATE.
 */
export async function fetchNet30Billing(
  startDate: string,
  endDate: string
): Promise<Net30QueryRow[]> {
  const rows = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      totalHours: sql<string | null>`SUM(${timeLogs.hours})`,
    })
    .from(timeLogs)
    .innerJoin(projects, eq(timeLogs.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(
      and(
        eq(clients.billingType, 'net_30'),
        isNull(timeLogs.deletedAt),
        isNull(projects.deletedAt),
        isNull(clients.deletedAt),
        gte(timeLogs.loggedOn, startDate),
        lte(timeLogs.loggedOn, endDate)
      )
    )
    .groupBy(clients.id, clients.name)

  return rows as Net30QueryRow[]
}

/**
 * Fetches the date bounds for the report based on earliest data across all sources.
 * Returns min cursor (earliest month with data) and max cursor (current month).
 */
export async function fetchReportDateBounds(): Promise<{
  min: MonthCursor
  max: MonthCursor
}> {
  const now = new Date()
  const currentCursor: MonthCursor = {
    year: now.getFullYear(),
    month: now.getMonth() + 1, // Convert 0-indexed to 1-indexed
  }

  // Find earliest time log date
  const [timeLogRow] = await db
    .select({
      earliestDate: sql<string | null>`MIN(${timeLogs.loggedOn})`,
    })
    .from(timeLogs)
    .where(isNull(timeLogs.deletedAt))
    .limit(1)

  // Find earliest hour block date (using LA timezone)
  const [hourBlockRow] = await db
    .select({
      earliestDate: sql<string | null>`MIN(DATE(${hourBlocks.createdAt} AT TIME ZONE 'America/Los_Angeles'))`,
    })
    .from(hourBlocks)
    .where(isNull(hourBlocks.deletedAt))
    .limit(1)

  // Parse dates and find the overall minimum
  const dates: Date[] = []

  if (timeLogRow?.earliestDate) {
    const d = new Date(timeLogRow.earliestDate)
    if (!Number.isNaN(d.getTime())) {
      dates.push(d)
    }
  }

  if (hourBlockRow?.earliestDate) {
    const d = new Date(hourBlockRow.earliestDate)
    if (!Number.isNaN(d.getTime())) {
      dates.push(d)
    }
  }

  // If no data found, return current month for both
  if (dates.length === 0) {
    return { min: currentCursor, max: currentCursor }
  }

  // Find the earliest date
  const earliestDate = dates.reduce((a, b) => (a < b ? a : b))

  const minCursor: MonthCursor = {
    year: earliestDate.getFullYear(),
    month: earliestDate.getMonth() + 1,
  }

  // Don't allow future months
  if (compareMonthCursor(minCursor, currentCursor) > 0) {
    return { min: currentCursor, max: currentCursor }
  }

  return { min: minCursor, max: currentCursor }
}

function compareMonthCursor(a: MonthCursor, b: MonthCursor): number {
  const aValue = a.year * 12 + (a.month - 1)
  const bValue = b.year * 12 + (b.month - 1)

  if (aValue < bValue) return -1
  if (aValue > bValue) return 1
  return 0
}
