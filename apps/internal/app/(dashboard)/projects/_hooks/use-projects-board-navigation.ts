'use client'

import { useMemo } from 'react'

import type { ProjectWithRelations } from '@/lib/types'
import { getProjectClientSegment } from '@/lib/projects/board/board-utils'

export type ProjectsBoardNavigation = {
  overviewHref: string
  boardHref: string
  activityHref: string
  reviewHref: string
  timeLogsHref: string
  scopeHref: string
  activityDisabled: boolean
  reviewDisabled: boolean
  timeLogsDisabled: boolean
  scopeDisabled: boolean
}

type UseProjectsBoardNavigationArgs = {
  activeProject: ProjectWithRelations | null
  clients: Array<{ id: string; slug: string | null }>
}

export function useProjectsBoardNavigation({
  activeProject,
  clients,
}: UseProjectsBoardNavigationArgs): ProjectsBoardNavigation {
  return useMemo(() => {
    const clientSlugLookup = new Map(
      clients.map(client => [client.id, client.slug ?? null])
    )

    const clientSegment =
      activeProject && getProjectClientSegment(activeProject, clientSlugLookup)

    const projectSlug = activeProject?.slug ?? null
    const projectPathBase =
      clientSegment && projectSlug
        ? `/projects/${clientSegment}/${projectSlug}`
        : null

    const defaultHref = '/projects'

    return {
      overviewHref: projectPathBase
        ? `${projectPathBase}/overview`
        : defaultHref,
      boardHref: projectPathBase ? `${projectPathBase}/tasks` : defaultHref,
      activityHref: projectPathBase
        ? `${projectPathBase}/activity`
        : defaultHref,
      reviewHref: projectPathBase ? `${projectPathBase}/review` : defaultHref,
      timeLogsHref: projectPathBase
        ? `${projectPathBase}/time-logs`
        : defaultHref,
      scopeHref: projectPathBase
        ? `${projectPathBase}/scope`
        : defaultHref,
      activityDisabled: !projectPathBase,
      reviewDisabled: !projectPathBase,
      timeLogsDisabled: !projectPathBase,
      scopeDisabled: !projectPathBase,
    }
  }, [activeProject, clients])
}
