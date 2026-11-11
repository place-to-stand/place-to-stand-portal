import type { Metadata } from 'next'

import { CompaniesListPage } from './_components/companies-list-page'

export const metadata: Metadata = {
  title: 'Companies',
}

// permission: companies.manage — CompaniesListPage calls requirePage('companies.manage')
export default async function CompaniesPage({
  searchParams,
}: PageProps<'/companies'>) {
  return <CompaniesListPage params={await searchParams} mode='active' />
}
