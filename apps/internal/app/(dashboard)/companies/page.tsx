import type { Metadata } from 'next'

import { requireCrmUser } from '@/lib/auth/session'
import {
  applyCompanyListParams,
  parseCompaniesSearchParams,
} from '@/lib/companies/filters'
import { countCompanies, listCompanies } from '@/lib/queries/companies'

import { CompaniesPageBody } from './_components/companies-page-body'

export const metadata: Metadata = {
  title: 'Companies',
}

export default async function CompaniesPage({
  searchParams,
}: PageProps<'/companies'>) {
  const user = await requireCrmUser()
  const params = await searchParams
  const listParams = parseCompaniesSearchParams(params)

  const [companies, counts] = await Promise.all([
    listCompanies(user, { status: 'active', search: listParams.search }),
    countCompanies(user),
  ])

  return (
    <CompaniesPageBody
      mode='active'
      companies={applyCompanyListParams(companies, listParams)}
      totalCount={counts.active}
      params={listParams}
    />
  )
}
