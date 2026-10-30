'use server'

import { revalidatePath } from 'next/cache'

import { roleCan } from '@/lib/auth/capabilities'
import { and, eq, isNull } from 'drizzle-orm'
import { clientHoursTotalsFor, getClientHoursTotals } from '@pts/db/hours'

import { requireCrmUser, requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { fetchProjectsForClient, type ClientProject } from '@/lib/data/clients'
import { currentBillingTypeSql } from '@/lib/queries/clients/billing-terms'
import { listClientUpdates } from '@/lib/updates'
import type { ClientUpdateSummary } from '@/app/(dashboard)/clients/[clientSlug]/_components/client-updates-section'
import type { SaveCompanyInput } from '@/lib/companies/schema'
import type {
  ClientLinkOption,
  CompanyActionResult,
  CompanyDetail,
  CompanyOption,
} from '@/lib/companies/types'
import { NotFoundError } from '@/lib/errors/http'
import {
  getCompanyDetail,
  listClientLinkOptions,
  listCompanyOptions,
  saveCompany as saveCompanyQuery,
  setCompanyArchived,
} from '@/lib/queries/companies'
import { UUID_PATTERN } from '@/lib/sheets/entities'

// A client is named after (and linked to) its company, so company saves also
// refresh the client and project lists that show client names.
const COMPANY_ROUTES = [
  '/companies',
  '/companies/archive',
  '/companies/activity',
  '/people',
  '/leads',
  '/clients',
  '/clients/archive',
  '/projects',
]

function revalidateCompanyRoutes() {
  for (const path of COMPANY_ROUTES) {
    revalidatePath(path)
  }
  revalidatePath('/clients/[clientSlug]', 'page')
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

/** Clients the company sheet can link; client records are admin-only. */
export async function fetchClientLinkOptions(): Promise<ClientLinkOption[]> {
  const user = await requireCrmUser()
  if (!roleCan(user.role, 'clients.manage')) return []
  return listClientLinkOptions()
}

export async function saveCompany(
  input: SaveCompanyInput
): Promise<CompanyActionResult> {
  const user = await requireCrmUser()
  const result = await saveCompanyQuery(user, input)
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
    .select({ slug: clients.slug, billingType: currentBillingTypeSql() })
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
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
