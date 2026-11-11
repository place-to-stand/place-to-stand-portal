import { requirePage } from '@/lib/auth/session'
import {
  applyCompanyListParams,
  parseCompaniesSearchParams,
} from '@/lib/companies/filters'
import { countCompanies, listCompanies } from '@/lib/queries/companies'
import { readPageSize } from '@/lib/pagination/page-size.server'
import type { RawSearchParams } from '@/lib/pagination/params'
import { redirectLegacyPreset } from '@/lib/pagination/legacy-preset'

import { CompaniesPageBody, type CompaniesMode } from './companies-page-body'

/** The companies list, live, clients or archived: all three tabs render this. */
export async function CompaniesListPage({
  params,
  mode,
}: {
  params: RawSearchParams
  mode: CompaniesMode
}) {
  const user = await requirePage('companies.manage')
  const parsed = parseCompaniesSearchParams(params)
  // A type on Clients, which lists clients only. (On Companies,
  // `?type=client` is the type filter's Client option.)
  if (mode === 'clients' && params.type !== undefined) {
    redirectLegacyPreset(params, {
      key: 'type',
      path: '/companies/clients',
      keep: () => false,
    })
  }
  const listParams =
    mode === 'clients' ? { ...parsed, type: 'client' as const } : parsed

  const [companies, counts, pageSize] = await Promise.all([
    listCompanies(user, {
      status: mode === 'archive' ? 'archived' : 'active',
      search: listParams.search,
    }),
    countCompanies(user),
    readPageSize(),
  ])
  // Filter and sort the whole list, then show one page of it.
  const filtered = applyCompanyListParams(companies, listParams)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(listParams.page, totalPages)
  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  // Clients counts every client, so a search needs the unsearched list.
  const clientsTotal =
    mode === 'clients'
      ? (listParams.search
          ? await listCompanies(user, { status: 'active', search: '' })
          : companies
        ).filter(row => Boolean(row.companyId)).length
      : 0
  const totalCount =
    mode === 'archive'
      ? counts.archived
      : mode === 'clients'
        ? clientsTotal
        : counts.active

  return (
    <CompaniesPageBody
      mode={mode}
      companies={pageRows}
      filteredCount={filtered.length}
      pagination={{ currentPage, totalPages, pageSize }}
      totalCount={totalCount}
      params={listParams}
    />
  )
}
