import type { Metadata } from 'next'

import { UUID_PATTERN } from '@/lib/sheets/entities'
import { buildQuerySuffix } from '@/lib/sheets/hrefs'

import { renderReviewRoute, reviewMetadata } from './review-route'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = {
  params: Promise<{
    clientSlug: string
    projectSlug: string
  }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = reviewMetadata

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function ProjectReviewPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const taskParam = firstParam(resolvedSearchParams.task) ?? null

  return renderReviewRoute({
    ...resolvedParams,
    taskId: taskParam && UUID_PATTERN.test(taskParam) ? taskParam : null,
    querySuffix: buildQuerySuffix(resolvedSearchParams),
  })
}
