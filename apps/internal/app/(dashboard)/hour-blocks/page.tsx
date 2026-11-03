import type { Metadata } from 'next'

import { HourBlocksListPage } from './_components/hour-blocks-list-page'

export const metadata: Metadata = {
  title: 'Hour blocks',
}

// permission: billing.manage — HourBlocksListPage calls requirePage('billing.manage')
export default async function HourBlocksPage({
  searchParams,
}: PageProps<'/hour-blocks'>) {
  return <HourBlocksListPage params={await searchParams} mode='active' />
}
