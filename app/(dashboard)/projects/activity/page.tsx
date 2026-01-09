import type { Metadata } from 'next'

import { AppShellHeader } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth/session'
import { listProjectsForSettings } from '@/lib/queries/projects'
import type { ClientRow } from '@/lib/settings/projects/project-sheet-form'

import { ProjectsActivitySection } from '../_components/projects-activity-section'
import { ProjectsAddButton } from '../_components/projects-add-button'
import { ProjectsTabsNav } from '../_components/projects-tabs-nav'

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
    <>
      <AppShellHeader>
        <div className='flex flex-col'>
          <h1 className='text-2xl font-semibold tracking-tight'>Projects</h1>
          <p className='text-muted-foreground text-sm'>
            Review project-level changes to keep audit history clear.
          </p>
        </div>
      </AppShellHeader>
      <div className='space-y-4'>
        {/* Tabs Row - Above the main container */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <ProjectsTabsNav activeTab='activity' className='flex-1 sm:flex-none' />
          <ProjectsAddButton clients={clientRows} />
        </div>
        {/* Main Container with Background */}
        <section className='bg-background rounded-xl border p-6 shadow-sm'>
          <ProjectsActivitySection />
        </section>
      </div>
    </>
  )
}
