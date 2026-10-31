'use server'
import { wasClientCompany } from '@pts/db/client-state'

import { revalidatePath } from 'next/cache'

import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { clientHoursTotalsFor, getClientHoursTotals } from '@pts/db/hours'

import { requireCrmUser, requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, projects, timeLogs } from '@/lib/db/schema'
import { fetchProjectsForClient, type ClientProject } from '@/lib/data/clients'
import {
  currentBillingTypeSql,
  currentMonthStartUtc,
  nextMonthStartUtc,
} from '@/lib/queries/clients/billing-terms'
import { createUpdateDraft, listClientUpdates } from '@/lib/updates'
import type { ClientUpdateSummary } from './_components/company-updates-section'
import { saveCompanySheet as saveCompanySheetMutation } from '@/lib/companies/save-company-sheet'
import type { SaveCompanySheetInput } from '@/lib/companies/sheet-save-schema'
import type {
  CompanyActionResult,
  CompanyDetail,
  CompanyOption,
} from '@/lib/companies/types'
import { NotFoundError } from '@/lib/errors/http'
import {
  getCompanyDetail,
  listCompanyOptions,
  setCompanyArchived,
} from '@/lib/queries/companies'
import { UUID_PATTERN } from '@/lib/sheets/entities'

// A client is named after (and linked to) its company, so company saves also
// refresh the client and project lists that show client names, and the hour
// blocks and monthly close that change with billing.
const COMPANY_ROUTES = [
  '/companies',
  '/invoices',
  '/companies/archive',
  '/companies/activity',
  '/people',
  '/leads',
  '/projects',
  '/hour-blocks',
  '/reports/monthly-close',
]

function revalidateCompanyRoutes() {
  for (const path of COMPANY_ROUTES) {
    revalidatePath(path)
  }
}

export type CompanySheetData = {
  company: CompanyDetail | null
}

/** Everything the company sheet needs; `null` id = create mode. */
export async function loadCompanySheet(
  companyId: string | null
): Promise<CompanySheetData | null> {
  const user = await requireCrmUser()

  if (!companyId) return { company: null }
  if (!UUID_PATTERN.test(companyId)) return null

  try {
    return { company: await getCompanyDetail(user, companyId) }
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
}

export async function fetchCompanyOptions(): Promise<CompanyOption[]> {
  const user = await requireCrmUser()
  return listCompanyOptions(user)
}

/**
 * The company sheet's Save: the company, its people, billing and portal
 * access in one transaction (see `saveCompanySheet`).
 */
export async function saveCompanySheet(
  input: SaveCompanySheetInput
): Promise<CompanyActionResult> {
  const user = await requireCrmUser()
  const result = await saveCompanySheetMutation(user, input)
  if (result.ok) revalidateCompanyRoutes()
  return result
}

export async function archiveCompany(
  companyId: string
): Promise<CompanyActionResult> {
  const user = await requireCrmUser()
  if (!UUID_PATTERN.test(companyId)) return { ok: false, error: 'Not found.' }
  const result = await setCompanyArchived(user, companyId, true)
  if (result.ok) revalidateCompanyRoutes()
  return result
}

export async function restoreCompany(
  companyId: string
): Promise<CompanyActionResult> {
  const user = await requireCrmUser()
  if (!UUID_PATTERN.test(companyId)) return { ok: false, error: 'Not found.' }
  const result = await setCompanyArchived(user, companyId, false)
  if (result.ok) revalidateCompanyRoutes()
  return result
}

export type CompanyClientWork = {
  clientSlug: string | null
  projects: ClientProject[]
  updates: ClientUpdateSummary[]
  /** Prepaid hours for the current era; null for net 30. */
  hours: { purchased: number; used: number; remaining: number } | null
  /**
   * Net 30: hours logged on its client projects this month, which a stop
   * before this month would leave unbilled. Null for prepaid (blocks count
   * in the month bought, billed or not).
   */
  hoursLoggedThisMonth: number | null
}

/** A client company's work for its Client column and Updates (admins). */
export async function loadCompanyClientWork(
  companyId: string
): Promise<CompanyClientWork | null> {
  const user = await requireUser()
  if (!UUID_PATTERN.test(companyId)) return null

  const [client] = await db
    .select({ slug: companies.slug, billingType: currentBillingTypeSql() })
    .from(companies)
    .where(
      // Former clients too: their Projects keep the history.
      and(wasClientCompany(), eq(companies.id, companyId))
    )
    .limit(1)
  if (!client) return null

  const net30 = client.billingType === 'net_30'
  const [projectRows, updates, totals, loggedThisMonth] = await Promise.all([
    fetchProjectsForClient(user, companyId),
    listClientUpdates({ companyId, limit: 5 }),
    getClientHoursTotals(db, [companyId]),
    net30 ? sumHoursLoggedThisMonth(companyId) : null,
  ])
  const balance = clientHoursTotalsFor(totals, companyId)

  return {
    clientSlug: client.slug,
    projects: projectRows,
    updates: updates.map(update => ({
      id: update.id,
      subject: update.subject,
      status: update.status,
      sentAt: update.sentAt,
      createdAt: update.createdAt,
    })),
    hours:
      client.billingType === 'prepaid'
        ? {
            purchased: balance.purchased,
            used: balance.used,
            remaining: balance.remaining,
          }
        : null,
    hoursLoggedThisMonth: loggedThisMonth,
  }
}

/** Hours logged this month (UTC) on a company's client projects. */
async function sumHoursLoggedThisMonth(companyId: string): Promise<number> {
  const [row] = await db
    .select({ hours: sql<string | null>`sum(${timeLogs.hours})` })
    .from(timeLogs)
    .innerJoin(projects, eq(projects.id, timeLogs.projectId))
    .where(
      and(
        eq(projects.companyId, companyId),
        eq(projects.type, 'CLIENT'),
        isNull(projects.deletedAt),
        isNull(timeLogs.deletedAt),
        gte(timeLogs.loggedOn, currentMonthStartUtc()),
        lt(timeLogs.loggedOn, nextMonthStartUtc())
      )
    )
  const hours = Number(row?.hours ?? 0)
  return Number.isFinite(hours) ? hours : 0
}

export type DraftUpdateResult =
  { success: true; id: string } | { success: false; error: string }

/**
 * Starts a draft update for a client company, generated the same way as
 * `pts updates draft` (see `lib/updates`); the caller navigates to it.
 */
export async function draftUpdateForClient(
  companyId: string
): Promise<DraftUpdateResult> {
  const user = await requireUser()
  if (!UUID_PATTERN.test(companyId)) {
    return { success: false, error: 'Invalid client id' }
  }
  try {
    const update = await createUpdateDraft(user, { clientRef: companyId })
    revalidatePath('/companies')
    return { success: true, id: update.id }
  } catch (error) {
    console.error('Failed to draft client update:', error)
    return {
      success: false,
      error: 'Unable to generate the draft. Please try again.',
    }
  }
}
