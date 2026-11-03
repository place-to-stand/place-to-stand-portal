import type { Metadata } from 'next'

import { InvoicesListPage } from '../_components/invoices-list-page'

export const metadata: Metadata = {
  title: 'Invoice archive',
}

// permission: billing.manage — InvoicesListPage calls requirePage('billing.manage')
export default async function InvoicesArchivePage({
  searchParams,
}: PageProps<'/invoices/archive'>) {
  return <InvoicesListPage params={await searchParams} mode='archive' />
}
