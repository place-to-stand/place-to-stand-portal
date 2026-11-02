import type { Metadata } from 'next'

import { buildQuerySuffix } from '@/lib/sheets/hrefs'

import { renderReviewRoute, reviewMetadata } from './review-route'

export const metadata: Metadata = reviewMetadata

export default async function ProjectReviewPage({
  params,
  searchParams,
}: PageProps<'/projects/[clientSlug]/[projectSlug]/review'>) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  return renderReviewRoute({
    ...resolvedParams,
    querySuffix: buildQuerySuffix(resolvedSearchParams),
  })
}
