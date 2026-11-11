import type { Metadata } from 'next'

import { CompaniesListPage } from '../_components/companies-list-page'

export const metadata: Metadata = {
  title: 'Clients',
}

// permission: companies.manage — CompaniesListPage calls requirePage('companies.manage')
export default async function ClientsPage({
  searchParams,
}: PageProps<'/companies/clients'>) {
  return <CompaniesListPage params={await searchParams} mode='clients' />
}
