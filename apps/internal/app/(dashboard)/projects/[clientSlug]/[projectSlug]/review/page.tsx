// permission: projects.admin_tabs — renderProjectTabRoute checks it
import type { Metadata } from 'next'

import {
  projectTabMetadata,
  renderProjectTabRoute,
} from '../_lib/project-tab-route'

export const metadata: Metadata = projectTabMetadata

export default function ProjectReviewRoute({
  params,
  searchParams,
}: PageProps<'/projects/[clientSlug]/[projectSlug]/review'>) {
  return renderProjectTabRoute({ tab: 'review', params, searchParams })
}
