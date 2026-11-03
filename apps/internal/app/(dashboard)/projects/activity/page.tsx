import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requirePage } from '@/lib/auth/session'
import { listProjectsForSettings } from '@/lib/queries/projects'
import type { ClientPickerRow } from '@/lib/projects/sheet/project-sheet-form'

import { ActivitySection } from '@/components/activity/activity-section'
import { ProjectsAddButton } from '../_components/projects-add-button'
import { PROJECTS_TABS } from '../_lib/tabs'
import { PagePanel } from '@/components/layout/page-panel'

export const metadata: Metadata = {
  title: 'Project activity',
}

export default async function ProjectsActivityPage() {
  const admin = await requirePage('activity.read_all')

  const managementResult = await listProjectsForSettings(admin, {
    status: 'active',
    limit: 1,
  })

  const clientRows: ClientPickerRow[] = managementResult.clients.map(
    client => ({
      id: client.id,
      name: client.name,
      deleted_at: client.deletedAt,
    })
  )

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/projects'), { label: 'Activity' }]}
      tabs={PROJECTS_TABS}
      activeTab='activity'
      primaryAction={<ProjectsAddButton clients={clientRows} />}
    >
      <PagePanel>
        <ActivitySection
          targetType='PROJECT'
          emptyState='No recent project activity.'
          description='Audit project creation, edits, archives, and deletions in one place.'
        />
      </PagePanel>
    </PageShell>
  )
}
