'use server'
import { wasClientCompany, clientEndedAtSql } from '@pts/db/client-state'

import { revalidatePath } from 'next/cache'

import { and, eq, isNull } from 'drizzle-orm'
import { clientHoursTotalsFor, getClientHoursTotals } from '@pts/db/hours'

import { requireCrmUser, requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { fetchProjectsForClient, type ClientProject } from '@/lib/data/clients'
import { currentBillingTypeSql } from '@/lib/queries/clients/billing-terms'
import { createUpdateDraft, listClientUpdates } from '@/lib/updates'
import type { ClientUpdateSummary } from './_components/company-updates-section'
import type { SaveCompanyInput } from '@/lib/companies/schema'
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
  saveCompany as saveCompanyQuery,
  setCompanyArchived,
} from '@/lib/queries/companies'
import { UUID_PATTERN } from '@/lib/sheets/entities'

// A client is named after (and linked to) its company, so company saves also
// refresh the client and project lists that show client names.
const COMPANY_ROUTES = [
  '/companies',
  '/invoices',
  '/companies/archive',
  '/companies/activity',
  '/people',
  '/leads',
  '/projects',
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

export async function saveCompany(
  input: SaveCompanyInput
): Promise<CompanyActionResult> {
  const user = await requireCrmUser()
  const result = await saveCompanyQuery(user, input)
  if (result.ok) revalidateCompanyRoutes()
  return result
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
}

/** A client company's work for its Projects and Billing tabs (admins). */
export async function loadCompanyClientWork(
  clientId: string
): Promise<CompanyClientWork | null> {
  const user = await requireUser()
  if (!UUID_PATTERN.test(clientId)) return null

  const [client] = await db
    .select({ slug: companies.slug, billingType: currentBillingTypeSql() })
    .from(companies)
    .where(
      and(
        wasClientCompany(),
        eq(companies.id, clientId),
        isNull(clientEndedAtSql)
      )
    )
    .limit(1)
  if (!client) return null

  const [projectRows, updates, totals] = await Promise.all([
    fetchProjectsForClient(user, clientId),
    listClientUpdates({ clientId, limit: 5 }),
    getClientHoursTotals(db, [clientId]),
  ])
  const balance = clientHoursTotalsFor(totals, clientId)

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
  }
}

export type DraftUpdateResult =
  { success: true; id: string } | { success: false; error: string }

/**
 * Starts a draft update for a client company, generated the same way as
 * `pts updates draft` (see `lib/updates`); the caller navigates to it.
 */
export async function draftUpdateForClient(
  clientId: string
): Promise<DraftUpdateResult> {
  const user = await requireUser()
  if (!UUID_PATTERN.test(clientId)) {
    return { success: false, error: 'Invalid client id' }
  }
  try {
    const update = await createUpdateDraft(user, { clientRef: clientId })
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
