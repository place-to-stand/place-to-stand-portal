import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { buildQuerySuffix } from '@/lib/sheets/hrefs'

import { renderReviewRoute, reviewMetadata } from './review-route'

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

// All awaits (params, search params, and the data access inside
// renderReviewRoute) live here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function ProjectReviewContent({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const taskParam = firstParam(resolvedSearchParams.task) ?? null

  return renderReviewRoute({
    ...resolvedParams,
    taskId: taskParam && UUID_PATTERN.test(taskParam) ? taskParam : null,
    querySuffix: buildQuerySuffix(resolvedSearchParams),
  })
}

// Static portion of the workspace chrome only — the project-name breadcrumb
// depends on fetched data, so the fallback shows the base crumb with a
// pulsing content area (mirrors ProjectsBoard's PageShell).
function ProjectReviewFallback() {
  return (
    <PageShell
      breadcrumbs={crumbsForNav('/projects')}
      contentClassName='flex min-h-fit flex-col gap-4 sm:gap-6'
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function ProjectReviewPage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<ProjectReviewFallback />}>
      <ProjectReviewContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}
