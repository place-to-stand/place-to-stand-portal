'use server'

import { revalidatePath } from 'next/cache'

import { requireCrmUser } from '@/lib/auth/session'
import { saveCompanySheet as saveCompanySheetMutation } from '@/lib/companies/save-company-sheet'
import type { SaveCompanySheetInput } from '@/lib/companies/sheet-save-schema'
import type { CompanyActionResult } from '@/lib/companies/types'
import { setCompanyArchived } from '@/lib/companies/archive'
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
