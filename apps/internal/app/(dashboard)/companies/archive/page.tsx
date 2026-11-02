import type { Metadata } from 'next'

import { requireCrmUser } from '@/lib/auth/session'
import {
  applyCompanyListParams,
  parseCompaniesSearchParams,
} from '@/lib/companies/filters'
import { countCompanies, listCompanies } from '@/lib/queries/companies'
import { readPageSize } from '@/lib/pagination/page-size.server'

import { CompaniesPageBody } from '../_components/companies-page-body'

export const metadata: Metadata = {
  title: 'Company archive',
}

export default async function CompaniesArchivePage({
  searchParams,
}: PageProps<'/companies/archive'>) {
  const user = await requireCrmUser()
  const params = await searchParams
  const listParams = parseCompaniesSearchParams(params)

  const [companies, counts, pageSize] = await Promise.all([
    listCompanies(user, { status: 'archived', search: listParams.search }),
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

  return (
    <CompaniesPageBody
      mode='archive'
      companies={pageRows}
      filteredCount={filtered.length}
      pagination={{ currentPage, totalPages, pageSize }}
      totalCount={counts.archived}
      params={listParams}
    />
  )
}
