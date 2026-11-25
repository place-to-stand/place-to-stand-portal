import type { Metadata } from 'next'

import { FeedbackListPage } from './_components/feedback-list-page'

export const metadata: Metadata = {
  title: 'Feedback',
}

// permission: feedback.manage — FeedbackListPage calls requirePage('feedback.manage')
export default async function FeedbackPage({
  searchParams,
}: PageProps<'/feedback'>) {
  return <FeedbackListPage params={await searchParams} mode='active' />
}
