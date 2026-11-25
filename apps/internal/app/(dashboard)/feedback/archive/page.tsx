import type { Metadata } from 'next'

import { FeedbackListPage } from '../_components/feedback-list-page'

export const metadata: Metadata = {
  title: 'Feedback archive',
}

// permission: feedback.manage — FeedbackListPage calls requirePage('feedback.manage')
export default async function FeedbackArchivePage({
  searchParams,
}: PageProps<'/feedback/archive'>) {
  return <FeedbackListPage params={await searchParams} mode='archive' />
}
