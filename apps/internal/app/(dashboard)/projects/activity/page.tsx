import type { Metadata } from 'next'
import { Suspense } from 'react'

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

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function ProjectsActivityContent() {
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
      <section className='bg-background rounded-xl border p-4 shadow-sm'>
        <ProjectsActivitySection />
      </section>
    </PageShell>
  )
}

// Identical header chrome (breadcrumbs · tabs · add button) so only the
// content area pulses while data streams in.
function ProjectsActivityPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/projects'), { label: 'Activity' }]}
      tabs={PROJECTS_TABS}
      activeTab='activity'
      primaryAction={<ProjectsAddButton clients={[]} />}
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

export default function ProjectsActivityPage() {
  return (
    <Suspense fallback={<ProjectsActivityPageFallback />}>
      <ProjectsActivityContent />
    </Suspense>
  )
}
