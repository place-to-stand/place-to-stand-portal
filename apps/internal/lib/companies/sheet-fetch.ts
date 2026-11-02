import { getJson } from '@/lib/http/get-json'
import { NEW_SHEET_VALUE } from '@/lib/sheets/entities'

import type { CompanyClientWork, CompanySheetData } from './sheet-loaders'

/** The company sheet's record; `null` id = create mode. */
export const fetchCompanySheet = (companyId: string | null) =>
  getJson<CompanySheetData | null>(
    `/api/companies/${companyId ?? NEW_SHEET_VALUE}/sheet`
  )

/** A client company's projects and hours (admins). */
export const fetchCompanyClientWork = (companyId: string) =>
  getJson<CompanyClientWork | null>(`/api/companies/${companyId}/client-work`)
