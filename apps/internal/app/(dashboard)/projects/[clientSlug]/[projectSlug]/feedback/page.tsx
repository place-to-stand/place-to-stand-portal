// permission: feedback.manage — renderProjectTabRoute checks projects.admin_tabs, the panel's reads assert feedback.manage
import type { Metadata } from 'next'

import {
  projectTabMetadata,
  renderProjectTabRoute,
} from '../_lib/project-tab-route'

export const metadata: Metadata = projectTabMetadata

export default function ProjectFeedbackRoute({
  params,
  searchParams,
}: PageProps<'/projects/[clientSlug]/[projectSlug]/feedback'>) {
  return renderProjectTabRoute({ tab: 'feedback', params, searchParams })
}
