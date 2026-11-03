import type { Metadata } from 'next'

import { SubmissionsListPage } from './_components/submissions-list-page'

export const metadata: Metadata = {
  title: 'Submissions',
}

// permission: submissions.manage — SubmissionsListPage calls requirePage('submissions.manage')
export default async function SubmissionsPage({
  searchParams,
}: PageProps<'/submissions'>) {
  return <SubmissionsListPage params={await searchParams} mode='active' />
}
