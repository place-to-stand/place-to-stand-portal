import type { Metadata } from 'next'

import { InvoicesListPage } from './_components/invoices-list-page'

export const metadata: Metadata = {
  title: 'Invoices',
}

// permission: billing.manage — InvoicesListPage calls requirePage('billing.manage')
export default async function InvoicesPage({
  searchParams,
}: PageProps<'/invoices'>) {
  return <InvoicesListPage params={await searchParams} mode='active' />
}
