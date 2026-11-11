import type { Metadata } from 'next'

import { CompaniesListPage } from '../_components/companies-list-page'

export const metadata: Metadata = {
  title: 'Company archive',
}

// permission: companies.manage — CompaniesListPage calls requirePage('companies.manage')
export default async function CompaniesArchivePage({
  searchParams,
}: PageProps<'/companies/archive'>) {
  return <CompaniesListPage params={await searchParams} mode='archive' />
}
