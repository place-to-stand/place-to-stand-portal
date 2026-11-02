import type { Metadata } from 'next'

import {
  projectTabMetadata,
  renderProjectTabRoute,
} from '../_lib/project-tab-route'

export const metadata: Metadata = projectTabMetadata

export default function ProjectTimeLogsRoute({
  params,
  searchParams,
}: PageProps<'/projects/[clientSlug]/[projectSlug]/time-logs'>) {
  return renderProjectTabRoute({ tab: 'timeLogs', params, searchParams })
}
