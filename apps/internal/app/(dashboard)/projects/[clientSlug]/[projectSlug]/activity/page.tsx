import type { Metadata } from 'next'

import {
  projectTabMetadata,
  renderProjectTabRoute,
} from '../_lib/project-tab-route'

export const metadata: Metadata = projectTabMetadata

export default function ProjectActivityRoute({
  params,
  searchParams,
}: PageProps<'/projects/[clientSlug]/[projectSlug]/activity'>) {
  return renderProjectTabRoute({ tab: 'activity', params, searchParams })
}
