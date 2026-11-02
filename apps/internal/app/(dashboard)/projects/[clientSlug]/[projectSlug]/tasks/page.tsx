import type { Metadata } from 'next'

import {
  projectTabMetadata,
  renderProjectTabRoute,
} from '../_lib/project-tab-route'

export const metadata: Metadata = projectTabMetadata

export default function ProjectBoardRoute({
  params,
  searchParams,
}: PageProps<'/projects/[clientSlug]/[projectSlug]/tasks'>) {
  return renderProjectTabRoute({ tab: 'board', params, searchParams })
}
