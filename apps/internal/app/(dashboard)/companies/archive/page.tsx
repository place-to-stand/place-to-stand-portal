import type { Metadata } from 'next'

import { requireCrmUser } from '@/lib/auth/session'
import { countCompanies, listCompanies } from '@/lib/queries/companies'

import { CompaniesPageBody } from '../_components/companies-page-body'

export const metadata: Metadata = {
  title: 'Archived companies',
}

export default async function CompaniesArchivePage({
  searchParams,
}: PageProps<'/companies/archive'>) {
  const user = await requireCrmUser()
  const params = await searchParams
  const rawSearch = Array.isArray(params.q) ? params.q[0] : params.q
  const search = (rawSearch ?? '').slice(0, 160)

  const [companies, counts] = await Promise.all([
    listCompanies(user, { status: 'archived', search }),
    countCompanies(user),
  ])

  return (
    <CompaniesPageBody
      mode='archive'
      companies={companies}
      totalCount={counts.archived}
      search={search}
    />
  )
}
