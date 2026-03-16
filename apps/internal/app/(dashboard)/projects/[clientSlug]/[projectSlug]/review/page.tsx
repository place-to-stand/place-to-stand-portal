import type { Metadata } from 'next'

import { renderReviewRoute, reviewMetadata } from './review-route'

type PageProps = {
  params: Promise<{
    clientSlug: string
    projectSlug: string
  }>
}

export const metadata: Metadata = reviewMetadata

export default async function ProjectReviewPage({ params }: PageProps) {
  const resolvedParams = await params
  return renderReviewRoute(resolvedParams)
}
