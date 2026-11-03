import type { Metadata } from 'next'

import { SubmissionsListPage } from '../_components/submissions-list-page'

export const metadata: Metadata = {
  title: 'Submission archive',
}

// permission: submissions.manage — SubmissionsListPage calls requirePage('submissions.manage')
export default async function SubmissionsArchivePage({
  searchParams,
}: PageProps<'/submissions/archive'>) {
  return <SubmissionsListPage params={await searchParams} mode='archive' />
}
