import type { Metadata } from 'next'

import { HourBlocksListPage } from '../_components/hour-blocks-list-page'

export const metadata: Metadata = {
  title: 'Hour block archive',
}

// permission: billing.manage — HourBlocksListPage calls requirePage('billing.manage')
export default async function HourBlocksArchivePage({
  searchParams,
}: PageProps<'/hour-blocks/archive'>) {
  return <HourBlocksListPage params={await searchParams} mode='archive' />
}
