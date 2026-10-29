'use server'

import { revalidatePath } from 'next/cache'

import { requireCrmUser } from '@/lib/auth/session'
import type { SaveCompanyInput } from '@/lib/companies/schema'
import type {
  CompanyActionResult,
  CompanyDetail,
  CompanyOption,
  CompanyOwnerOption,
} from '@/lib/companies/types'
import { fetchCrmUsers } from '@/lib/data/users'
import { NotFoundError } from '@/lib/errors/http'
import {
  getCompanyDetail,
  listCompanyOptions,
  saveCompany as saveCompanyQuery,
  setCompanyArchived,
  setCompanyChampion,
} from '@/lib/queries/companies'
import { UUID_PATTERN } from '@/lib/sheets/entities'

const COMPANY_ROUTES = ['/companies', '/companies/archive', '/contacts', '/leads']

function revalidateCompanyRoutes() {
  for (const path of COMPANY_ROUTES) {
    revalidatePath(path)
  }
}

export type CompanySheetData = {
  company: CompanyDetail | null
  owners: CompanyOwnerOption[]
}

/** Everything the company sheet needs; `null` id = create mode. */
export async function loadCompanySheet(
  companyId: string | null
): Promise<CompanySheetData | null> {
  const user = await requireCrmUser()
  const crmUsers = await fetchCrmUsers()
  const owners = crmUsers
    .filter(person => !person.disabled_at)
    .map(person => ({
      id: person.id,
      name: person.full_name?.trim() || person.email,
      avatarUrl: person.avatar_url,
    }))

  if (!companyId) return { company: null, owners }
  if (!UUID_PATTERN.test(companyId)) return null

  try {
    return { company: await getCompanyDetail(user, companyId), owners }
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

export async function makeCompanyChampion(
  companyId: string,
  contactId: string | null
): Promise<CompanyActionResult> {
  const user = await requireCrmUser()
  if (
    !UUID_PATTERN.test(companyId) ||
    (contactId !== null && !UUID_PATTERN.test(contactId))
  ) {
    return { ok: false, error: 'Not found.' }
  }
  const result = await setCompanyChampion(user, companyId, contactId)
  if (result.ok) revalidateCompanyRoutes()
  return result
}
