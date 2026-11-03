import type { Metadata } from 'next'

import { requirePage } from '@/lib/auth/session'
import { PROJECTS_TABS } from '../_lib/tabs'
import { hasClientDirectory } from '@/lib/queries/companies/billing'
import { ProjectsAddButton } from '../_components/projects-add-button'
import { EntityActivityPage } from '@/components/activity/entity-activity-page'

export const metadata: Metadata = {
  title: 'Project activity',
}

export default async function ProjectsActivityPage() {
  await requirePage('activity.read_all')
  const hasClients = await hasClientDirectory()

  return (
    <EntityActivityPage
      navHref='/projects'
      tabs={PROJECTS_TABS}
      primaryAction={<ProjectsAddButton hasClients={hasClients} />}
      targetType='PROJECT'
      emptyState='No recent project activity.'
      description='Audit project creation, edits, archives, and deletions in one place.'
    />
  )
}
