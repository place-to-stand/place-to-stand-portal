import type { Metadata } from 'next'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireRole } from '@/lib/auth/session'
import { listProjectsForSettings } from '@/lib/queries/projects'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'

import { ProjectsActivitySection } from '../_components/projects-activity-section'
import { ProjectsAddButton } from '../_components/projects-add-button'
import { PROJECTS_TABS } from '../_lib/tabs'

export const metadata: Metadata = {
  title: 'Project Activity | Place to Stand Portal',
}

export default async function ProjectsActivityPage() {
  const admin = await requireRole('ADMIN')

  const managementResult = await listProjectsForSettings(admin, {
    status: 'active',
    limit: 1,
  })

  const clientRows: ClientRow[] = managementResult.clients.map(client => ({
    id: client.id,
    name: client.name,
    deleted_at: client.deletedAt,
  }))

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/projects'), { label: 'Activity' }]}
      tabs={PROJECTS_TABS}
      activeTab='activity'
      primaryAction={<ProjectsAddButton clients={clientRows} />}
    >
      <section className='bg-background rounded-xl border p-6 shadow-sm'>
        <ProjectsActivitySection />
      </section>
    </PageShell>
  )
}
